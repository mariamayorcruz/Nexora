import { timingSafeEqual } from 'node:crypto';
import type { NextResponse } from 'next/server';
import { OAUTH_STATE_MAX_AGE_MS } from '@/lib/oauth-state';

/** Browser correlation cookie for Connect OAuth (nonce only — not a session/JWT). */
export const CONNECT_OAUTH_NONCE_COOKIE = 'nexora_connect_oauth_nonce';

/** Scoped to Connect OAuth routes only. */
export const CONNECT_OAUTH_COOKIE_PATH = '/api/connect/oauth';

/**
 * Optional explicit cookie Domain from trusted server env only.
 * Example: `.gotnexora.com` so apex + www share the correlation cookie when
 * CONNECT_OAUTH_REDIRECT_BASE_URL and the app host differ by www.
 * Never derived from the request Host header.
 */
export function getConnectOAuthCookieDomain(): string | undefined {
  const configured = String(process.env.CONNECT_OAUTH_COOKIE_DOMAIN || '').trim();
  if (!configured) return undefined;

  // Allow `.example.com` or `example.com` only — reject host headers / paths.
  if (!/^\.?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(configured)) {
    return undefined;
  }

  return configured;
}

export function connectOAuthNonceCookieOptions() {
  const domain = getConnectOAuthCookieDomain();
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: CONNECT_OAUTH_COOKIE_PATH,
    maxAge: Math.floor(OAUTH_STATE_MAX_AGE_MS / 1000),
    ...(domain ? { domain } : {}),
  };
}

export function clearConnectOAuthNonceCookie(response: NextResponse) {
  const domain = getConnectOAuthCookieDomain();
  response.cookies.set(CONNECT_OAUTH_NONCE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: CONNECT_OAUTH_COOKIE_PATH,
    maxAge: 0,
    ...(domain ? { domain } : {}),
  });
}

export function setConnectOAuthNonceCookie(response: NextResponse, nonce: string) {
  response.cookies.set(CONNECT_OAUTH_NONCE_COOKIE, nonce, connectOAuthNonceCookieOptions());
}

export function timingSafeEqualString(left: string, right: string): boolean {
  const a = Buffer.from(String(left), 'utf8');
  const b = Buffer.from(String(right), 'utf8');
  if (a.length === 0 || a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Require the HttpOnly correlation cookie nonce to match the signed state nonce.
 */
export function verifyConnectOAuthBrowserCorrelation(params: {
  stateNonce: string;
  cookieNonce: string | undefined;
}): { ok: true } | { ok: false; reason: 'missing_cookie' | 'nonce_mismatch' } {
  const cookieNonce = String(params.cookieNonce || '').trim();
  if (!cookieNonce) {
    return { ok: false, reason: 'missing_cookie' };
  }

  const stateNonce = String(params.stateNonce || '').trim();
  if (!stateNonce || !timingSafeEqualString(cookieNonce, stateNonce)) {
    return { ok: false, reason: 'nonce_mismatch' };
  }

  return { ok: true };
}
