import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  TRACKING_COOKIE_MAX_AGE,
  TRACKING_COOKIE_SID,
  TRACKING_COOKIE_TID,
  SESSION_COOKIE_MAX_AGE,
  cleanTrackingParams,
  getOrCreateSessionKey,
  getOrCreateTrackerId,
  getReferrer,
  getRequestPath,
  getTrackingFields,
  safeInternalPath,
} from '@/lib/tracking';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const currentUrl = request.nextUrl;
  const target = safeInternalPath(currentUrl.searchParams.get('next'), '/');
  const trackerId = getOrCreateTrackerId(request.cookies.get(TRACKING_COOKIE_TID)?.value);
  const sessionKey = getOrCreateSessionKey(request.cookies.get(TRACKING_COOKIE_SID)?.value);

  const redirectTo = new URL(target, currentUrl.origin);
  redirectTo.searchParams.delete('__trk');

  const response = NextResponse.redirect(redirectTo);
  response.cookies.set(TRACKING_COOKIE_TID, trackerId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TRACKING_COOKIE_MAX_AGE,
  });
  response.cookies.set(TRACKING_COOKIE_SID, sessionKey, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE,
  });

  try {
    const tracking = getTrackingFields(currentUrl);
    await prisma.attributionSession.upsert({
      where: { trackerId },
      create: {
        trackerId,
        sessionKey,
        landingPath: cleanTrackingParams(currentUrl),
        referrer: getReferrer(request),
        ...tracking,
      },
      update: {
        sessionKey,
        lastSeenAt: new Date(),
        landingPath: getRequestPath(request),
        referrer: getReferrer(request),
        ...tracking,
      },
    });
  } catch (error) {
    // Capture should never block navigation.
    console.error('tracking capture error', error);
  }

  return response;
}
