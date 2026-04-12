import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  TRACKING_COOKIE_CONSENT,
  TRACKING_COOKIE_SID,
  TRACKING_COOKIE_TID,
  buildDedupKey,
  getOrCreateSessionKey,
  getOrCreateTrackerId,
} from '@/lib/tracking';

export const dynamic = 'force-dynamic';

function normalizeJsonPayload(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return value as Prisma.InputJsonValue;
  }

  return undefined;
}

type EventPayload = {
  eventName?: string;
  eventType?: string;
  path?: string;
  source?: string;
  value?: number;
  currency?: string;
  eventTs?: string;
  payload?: unknown;
};

export async function POST(request: NextRequest) {
  const consent = request.cookies.get(TRACKING_COOKIE_CONSENT)?.value || 'unknown';
  if (consent !== 'granted') {
    return NextResponse.json({ ignored: true, reason: 'consent_not_granted' }, { status: 202 });
  }

  let body: EventPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const eventName = typeof body.eventName === 'string' ? body.eventName.trim() : '';
  if (!eventName) {
    return NextResponse.json({ error: 'eventName is required' }, { status: 400 });
  }

  const eventType = typeof body.eventType === 'string' && body.eventType.trim() ? body.eventType.trim() : 'custom';
  const trackerId = getOrCreateTrackerId(request.cookies.get(TRACKING_COOKIE_TID)?.value);
  const sessionKey = getOrCreateSessionKey(request.cookies.get(TRACKING_COOKIE_SID)?.value);
  const dedupKey = buildDedupKey({
    trackerId,
    sessionKey,
    eventName,
    eventType,
    path: typeof body.path === 'string' ? body.path : undefined,
    eventTs: typeof body.eventTs === 'string' ? body.eventTs : undefined,
  });

  try {
    const session = await prisma.attributionSession.upsert({
      where: { trackerId },
      create: {
        trackerId,
        sessionKey,
        landingPath: typeof body.path === 'string' ? body.path : undefined,
        consentStatus: 'granted',
        consentUpdatedAt: new Date(),
      },
      update: {
        sessionKey,
        lastSeenAt: new Date(),
        consentStatus: 'granted',
      },
    });

    await prisma.attributionEvent.create({
      data: {
        attributionSessionId: session.id,
        trackerId,
        sessionKey,
        eventName,
        eventType,
        path: typeof body.path === 'string' ? body.path : undefined,
        source: typeof body.source === 'string' ? body.source : undefined,
        value: typeof body.value === 'number' ? body.value : undefined,
        currency: typeof body.currency === 'string' ? body.currency : undefined,
        payload: normalizeJsonPayload(body.payload),
        dedupKey,
        eventTs: typeof body.eventTs === 'string' ? new Date(body.eventTs) : new Date(),
      },
    });

    const response = NextResponse.json({ success: true, dedupKey });
    response.cookies.set(TRACKING_COOKIE_TID, trackerId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    response.cookies.set(TRACKING_COOKIE_SID, sessionKey, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    const asAny = error as { code?: string };
    if (asAny?.code === 'P2002') {
      return NextResponse.json({ duplicate: true, dedupKey }, { status: 200 });
    }

    console.error('tracking event error', error);
    return NextResponse.json({ error: 'Could not track event' }, { status: 500 });
  }
}
