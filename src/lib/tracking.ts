import { createHash, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';

export const TRACKING_COOKIE_TID = 'nxa_tid';
export const TRACKING_COOKIE_SID = 'nxa_sid';
export const TRACKING_COOKIE_CONSENT = 'nxa_consent';

export const TRACKING_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24;

const TRACKING_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'ttclid',
  'msclkid',
] as const;

type TrackingKey = (typeof TRACKING_KEYS)[number];

function isTrackingKey(value: string): value is TrackingKey {
  return TRACKING_KEYS.includes(value as TrackingKey);
}

export function hasTrackingSignals(url: URL): boolean {
  for (const key of url.searchParams.keys()) {
    if (isTrackingKey(key)) {
      return true;
    }
  }

  return false;
}

export function getTrackingFields(url: URL) {
  return {
    utmSource: url.searchParams.get('utm_source') || undefined,
    utmMedium: url.searchParams.get('utm_medium') || undefined,
    utmCampaign: url.searchParams.get('utm_campaign') || undefined,
    utmTerm: url.searchParams.get('utm_term') || undefined,
    utmContent: url.searchParams.get('utm_content') || undefined,
    gclid: url.searchParams.get('gclid') || undefined,
    fbclid: url.searchParams.get('fbclid') || undefined,
    ttclid: url.searchParams.get('ttclid') || undefined,
    msclkid: url.searchParams.get('msclkid') || undefined,
  };
}

export function cleanTrackingParams(url: URL): string {
  const clean = new URL(url.toString());

  for (const [key] of clean.searchParams.entries()) {
    if (isTrackingKey(key) || key === '__trk') {
      clean.searchParams.delete(key);
    }
  }

  return `${clean.pathname}${clean.search}${clean.hash}`;
}

export function safeInternalPath(input: string | null | undefined, fallback = '/'): string {
  if (!input) {
    return fallback;
  }

  const value = input.trim();
  if (!value.startsWith('/')) {
    return fallback;
  }

  if (value.startsWith('//')) {
    return fallback;
  }

  try {
    const asUrl = new URL(value, 'http://localhost');
    return `${asUrl.pathname}${asUrl.search}${asUrl.hash}`;
  } catch {
    return fallback;
  }
}

export function buildDedupKey(params: {
  trackerId: string;
  sessionKey: string;
  eventName: string;
  eventType: string;
  path?: string;
  eventTs?: string;
}) {
  const payload = [
    params.trackerId,
    params.sessionKey,
    params.eventName,
    params.eventType,
    params.path || '',
    params.eventTs || '',
  ].join('|');

  return createHash('sha256').update(payload).digest('hex');
}

export function getOrCreateTrackerId(existing?: string | null) {
  if (existing && existing.length >= 12 && existing.length <= 128) {
    return existing;
  }

  return randomUUID();
}

export function getOrCreateSessionKey(existing?: string | null) {
  if (existing && existing.length >= 12 && existing.length <= 128) {
    return existing;
  }

  return randomUUID();
}

export function getReferrer(request: NextRequest) {
  return request.headers.get('referer') || undefined;
}

export function getRequestPath(request: NextRequest) {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`;
}
