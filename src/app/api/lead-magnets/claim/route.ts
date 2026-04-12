import { NextRequest, NextResponse } from 'next/server';
import { validateEmail } from '@/lib/auth';
import { buildMasterclassEmail } from '@/lib/lead-magnets';
import { isEmailDeliveryConfigured, sendTransactionalEmail } from '@/lib/mailer';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || '').trim();
    const niche = String(body.niche || '').trim().toLowerCase();
    const source = String(body.source || 'masterclass').trim() || 'masterclass';
    const resource = String(body.resource || 'nexora-decision-map').trim() || 'nexora-decision-map';

    if (!validateEmail(email)) {
      return NextResponse.json({ error: 'Necesitamos un email válido para entregarte el recurso.' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const leadCapture =
      (await prisma.leadCapture.findFirst({
        where: {
          email,
          source,
          resource,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      })) ||
      (await prisma.leadCapture.create({
        data: {
          email,
          name: name || null,
          source,
          resource,
          userId: existingUser?.id || null,
        },
      }));

    let deliveryStatus: 'sent' | 'pending_setup' | 'failed' = 'pending_setup';

    if (isEmailDeliveryConfigured()) {
      try {
        const emailPayload = await buildMasterclassEmail({ name, email, niche });
        await sendTransactionalEmail({
          to: email,
          subject: emailPayload.subject,
          html: emailPayload.html,
          text: emailPayload.text,
          attachments: emailPayload.attachments,
        });
        deliveryStatus = 'sent';
      } catch (emailError) {
        console.error('Masterclass email delivery error:', emailError);
        deliveryStatus = 'failed';
      }
    }

    return NextResponse.json({
      success: true,
      leadCaptureId: leadCapture.id,
      resource,
      deliveryStatus,
      redirectUrl: `/masterclass/gracias?resource=${resource}&delivery=${deliveryStatus}&email=${encodeURIComponent(email)}&niche=${encodeURIComponent(niche || 'servicios')}`,
    });
  } catch (error) {
    console.error('Lead magnet claim error:', error);
    return NextResponse.json({ error: 'No pudimos registrar tu acceso en este momento.' }, { status: 500 });
  }
}
