import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import { isEmailDeliveryConfigured, sendTransactionalEmail } from '@/lib/mailer';
import {
  applyTemplateVars,
  parseStoredCadence,
  resolveMeetingLink,
  serializeCadence,
  toMailerAttachments,
  type SalesEngineConfig,
} from '@/lib/crm-sequences';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.crmWorkspaceSettings.findUnique({ where: { userId } });
    const parsed = parseStoredCadence(settings?.defaultCadence);

    return NextResponse.json({
      templates: parsed.salesEngine.followUpTemplates,
      sentLogs: parsed.salesEngine.sentLogs,
      meetingLinks: parsed.salesEngine.meetingLinks,
      calendar: parsed.salesEngine.calendar,
    });
  } catch (error) {
    console.error('Error fetching followups:', error);
    return NextResponse.json({ error: 'Error fetching followups' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      leadId?: string;
      to?: string;
      templateId?: string;
      subject?: string;
      body?: string;
    };

    const settings = await prisma.crmWorkspaceSettings.findUnique({ where: { userId } });
    const parsed = parseStoredCadence(settings?.defaultCadence);
    const salesEngine = parsed.salesEngine;

    let to = String(body.to || '').trim();
    let leadName = 'cliente';

    if (!to && body.leadId) {
      const lead = await prisma.crmLead.findFirst({
        where: { id: String(body.leadId), userId },
      });

      if (!lead) {
        return NextResponse.json({ error: 'Lead no encontrado.' }, { status: 404 });
      }

      if (lead.email) {
        to = lead.email;
        leadName = lead.name;
      } else {
        const linkedCapture = await prisma.leadCapture.findFirst({
          where: {
            crmLeadId: lead.id,
          },
          orderBy: { createdAt: 'desc' },
          select: {
            email: true,
            name: true,
          },
        });

        if (!linkedCapture?.email) {
          return NextResponse.json(
            {
              error:
                'Este lead no tiene email en CRM ni en capturas. Agrega email para enviar follow-up.',
            },
            { status: 400 }
          );
        }

        to = linkedCapture.email;
        leadName = linkedCapture.name || lead.name;
      }
    }

    if (!to) {
      return NextResponse.json({ error: 'Email de destinatario requerido.' }, { status: 400 });
    }

    const template =
      salesEngine.followUpTemplates.find((item) => item.id === body.templateId) ||
      salesEngine.followUpTemplates.find((item) => item.active && item.trigger === 'lead_followup') ||
      salesEngine.followUpTemplates[0];

    const meetingLink = resolveMeetingLink(salesEngine);
    const dashboardUrl = `${(process.env.NEXT_PUBLIC_DOMAIN || 'https://www.gotnexora.com').replace(/\/$/, '')}/dashboard`;
    const subject = applyTemplateVars(String(body.subject || template?.subject || 'Seguimiento Nexora').trim(), {
      name: leadName,
      meetingLink: meetingLink || '',
      dashboardUrl,
      email: to,
    });
    const bodyText = applyTemplateVars(String(body.body || template?.body || ''), {
      name: leadName,
      meetingLink: meetingLink || '',
      dashboardUrl,
      email: to,
    });

    let status: 'sent' | 'failed' | 'pending_setup' = 'pending_setup';

    if (isEmailDeliveryConfigured()) {
      try {
        await sendTransactionalEmail({
          to,
          subject,
          text: bodyText,
          html: `<div style="white-space:pre-wrap;font-family:Arial,sans-serif;line-height:1.6">${bodyText}</div>`,
          attachments: toMailerAttachments(template),
        });
        status = 'sent';
      } catch {
        status = 'failed';
      }
    }

    const nextLogs = [
      {
        id: randomUUID(),
        to,
        subject,
        status,
        sentAt: new Date().toISOString(),
        templateId: template?.id,
        trigger: template?.trigger,
      },
      ...salesEngine.sentLogs,
    ].slice(0, 100);

    const nextEngine: SalesEngineConfig = {
      ...salesEngine,
      sentLogs: nextLogs,
    };

    await prisma.crmWorkspaceSettings.upsert({
      where: { userId },
      update: {
        defaultCadence: serializeCadence({
          cadence: parsed.cadence || '48h',
          salesEngine: nextEngine,
        }),
      },
      create: {
        userId,
        emailAutomationEnabled: true,
        whatsappEnabled: false,
        phoneEnabled: false,
        externalCrmEnabled: false,
        autoFollowUpEnabled: true,
        defaultCadence: serializeCadence({
          cadence: parsed.cadence || '48h',
          salesEngine: nextEngine,
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      status,
      sentLog: nextLogs[0],
    });
  } catch (error) {
    console.error('Error sending followup:', error);
    return NextResponse.json({ error: 'Error sending followup' }, { status: 500 });
  }
}
