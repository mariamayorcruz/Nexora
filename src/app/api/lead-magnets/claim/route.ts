import { NextRequest, NextResponse } from 'next/server';
import { validateEmail } from '@/lib/auth';
import { buildAuditPdfUrl } from '@/lib/audit-flow';
import { resolveAppBaseUrlFromEnv } from '@/lib/app-base-url';
import { signLeadAuditPdfToken } from '@/lib/jwt';
import { buildMasterclassEmail } from '@/lib/lead-magnets';
import { isEmailDeliveryConfigured, sendTransactionalEmail } from '@/lib/mailer';
import { prisma } from '@/lib/prisma';
import { TRACKING_COOKIE_SID, TRACKING_COOKIE_TID } from '@/lib/tracking';

export const dynamic = 'force-dynamic';

/** Resuelve el trackerId de AttributionSession desde cookies; solo si ya existe sesión en BD. */
async function resolveAttributionTrackerIdFromRequest(request: NextRequest): Promise<string | null> {
  const tidRaw = request.cookies.get(TRACKING_COOKIE_TID)?.value?.trim();
  const sidRaw = request.cookies.get(TRACKING_COOKIE_SID)?.value?.trim();
  const tid = tidRaw && tidRaw.length >= 12 && tidRaw.length <= 128 ? tidRaw : null;
  const sid = sidRaw && sidRaw.length >= 12 && sidRaw.length <= 128 ? sidRaw : null;

  if (tid) {
    const row = await prisma.attributionSession.findUnique({
      where: { trackerId: tid },
      select: { trackerId: true },
    });
    if (row) return row.trackerId;
  }
  if (sid) {
    const row = await prisma.attributionSession.findUnique({
      where: { sessionKey: sid },
      select: { trackerId: true },
    });
    if (row) return row.trackerId;
  }
  return null;
}

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

    const nameForDb = name.trim() ? name.trim() : null;

    let leadCapture =
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
          name: nameForDb,
          source,
          resource,
          userId: existingUser?.id || null,
        },
      }));

    if (leadCapture.name !== nameForDb) {
      leadCapture = await prisma.leadCapture.update({
        where: { id: leadCapture.id },
        data: { name: nameForDb },
      });
    }

    const attributionTrackerId = await resolveAttributionTrackerIdFromRequest(request);
    if (attributionTrackerId && !leadCapture.trackerId) {
      leadCapture = await prisma.leadCapture.update({
        where: { id: leadCapture.id },
        data: { trackerId: attributionTrackerId },
      });
    }

    let deliveryStatus: 'sent' | 'pending_setup' | 'failed' = 'pending_setup';

    const origin = resolveAppBaseUrlFromEnv();
    const pdfToken = signLeadAuditPdfToken(leadCapture.id, niche || 'servicios');
    const pdfDownloadUrl = buildAuditPdfUrl(origin, pdfToken);

    if (isEmailDeliveryConfigured()) {
      try {
        const emailPayload = await buildMasterclassEmail({
          name,
          email,
          niche,
          pdfDownloadUrl,
        });
        const result = await sendTransactionalEmail({
          to: email,
          subject: emailPayload.subject,
          html: emailPayload.html,
          text: emailPayload.text,
          attachments: emailPayload.attachments,
        });
        if (result.delivered) {
          deliveryStatus = 'sent';
        } else {
          console.error('[lead-magnets] Email not delivered:', result);
          deliveryStatus = 'failed';
        }
      } catch (emailError) {
        console.error('Masterclass email delivery error:', emailError);
        deliveryStatus = 'failed';
      }
    }

    const thanksQs = new URLSearchParams({
      resource,
      delivery: deliveryStatus,
      email,
      niche: niche || 'servicios',
      t: pdfToken,
    });
    if (name) thanksQs.set('name', name);

    return NextResponse.json({
      success: true,
      leadCaptureId: leadCapture.id,
      resource,
      deliveryStatus,
      redirectUrl: `/masterclass/gracias?${thanksQs.toString()}`,
    });
  } catch (error) {
    console.error('Lead magnet claim error:', error);
    return NextResponse.json({ error: 'No pudimos registrar tu acceso en este momento.' }, { status: 500 });
  }
}
