import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  crmWriteErrorResponse,
  NEXORA_ORGANIZATION_HEADER,
  resolveCrmWriteOrganization,
} from '@/lib/tenancy/resolve-crm-write-organization';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const authorizationHeader = request.headers.get('authorization');
    const writeOrg = await resolveCrmWriteOrganization({
      authorizationHeader,
      organizationIdHeader: request.headers.get(NEXORA_ORGANIZATION_HEADER),
    });
    if (!writeOrg.ok) {
      return crmWriteErrorResponse(writeOrg);
    }

    // Point 8B-5B: tenant-scoped by organizationId. Do NOT set organizationId.
    const lead = await prisma.crmLead.findFirst({
      where: { id: params.leadId, organizationId: writeOrg.context.organizationId },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead no encontrado.' }, { status: 404 });
    }

    const body = await request.json();
    const { channel, message } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'El mensaje no puede estar vacío.' }, { status: 400 });
    }

    if ((channel === 'sms' || channel === 'whatsapp') && lead.phone) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;

      if (accountSid && authToken && fromNumber) {
        const toNumber = lead.phone.startsWith('+')
          ? lead.phone
          : `+1${lead.phone.replace(/\D/g, '')}`;

        const twilioResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              From: fromNumber,
              To: toNumber,
              Body: message.trim(),
            }).toString(),
          }
        );

        const twilioData = await twilioResponse.json();

        if (!twilioResponse.ok) {
          return NextResponse.json(
            {
              error: `Error Twilio: ${twilioData.message || 'No se pudo enviar'}`,
            },
            { status: 400 }
          );
        }

        await prisma.crmLead.update({
          where: { id: lead.id, organizationId: writeOrg.context.organizationId },
          data: {
            lastContactedAt: new Date(),
            notes: lead.notes
              ? `${lead.notes}\n[${channel.toUpperCase()} ${new Date().toLocaleString()}]: ${message.trim()}`
              : `[${channel.toUpperCase()} ${new Date().toLocaleString()}]: ${message.trim()}`,
          },
        });

        return NextResponse.json({
          success: true,
          messageSid: twilioData.sid,
          status: twilioData.status,
        });
      }
    }

    await prisma.crmLead.update({
      where: { id: lead.id, organizationId: writeOrg.context.organizationId },
      data: {
        lastContactedAt: new Date(),
        notes: lead.notes
          ? `${lead.notes}\n[${channel.toUpperCase()} ${new Date().toLocaleString()}]: ${message.trim()}`
          : `[${channel.toUpperCase()} ${new Date().toLocaleString()}]: ${message.trim()}`,
      },
    });

    return NextResponse.json({ success: true, status: 'saved' });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Error al enviar mensaje' }, { status: 500 });
  }
}
