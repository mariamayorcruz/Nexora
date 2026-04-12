import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  TRACKING_COOKIE_CONSENT,
  TRACKING_COOKIE_MAX_AGE,
  TRACKING_COOKIE_TID,
} from '@/lib/tracking';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['granted', 'denied']);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const consentRaw = typeof body?.consent === 'string' ? body.consent.toLowerCase() : '';

    if (!ALLOWED.has(consentRaw)) {
      return NextResponse.json({ error: 'Invalid consent value' }, { status: 400 });
    }

    const response = NextResponse.json({ success: true, consent: consentRaw });
    response.cookies.set(TRACKING_COOKIE_CONSENT, consentRaw, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: TRACKING_COOKIE_MAX_AGE,
    });

    const trackerId = request.cookies.get(TRACKING_COOKIE_TID)?.value;
    if (trackerId) {
      try {
        await prisma.attributionSession.updateMany({
          where: { trackerId },
          data: {
            consentStatus: consentRaw,
            consentUpdatedAt: new Date(),
            lastSeenAt: new Date(),
          },
        });
      } catch (error) {
        console.error('tracking consent update error', error);
      }
    }

    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
