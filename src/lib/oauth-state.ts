import { createHmac, timingSafeEqual } from 'node:crypto';

/** Default OAuth state lifetime: 10 minutes. */
export const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

export function getOAuthStateSecret() {
  return String(process.env.OAUTH_STATE_SECRET || '').trim();
}

/**
 * Sign an OAuth state payload with HMAC-SHA256 using OAUTH_STATE_SECRET.
 * Fail-closed: throws if the server secret is missing.
 */
export function signOAuthState(payload: Record<string, string>): string {
  const secret = getOAuthStateSecret();
  if (!secret) {
    throw new Error('Missing OAUTH_STATE_SECRET');
  }

  const payloadJson = JSON.stringify(payload);
  const signature = createHmac('sha256', secret).update(payloadJson).digest('hex');

  return Buffer.from(
    JSON.stringify({
      payload,
      signature,
    }),
    'utf-8'
  ).toString('base64url');
}

export type OAuthStateVerifyFailureReason =
  | 'missing'
  | 'malformed'
  | 'unsigned'
  | 'missing_secret'
  | 'invalid_signature'
  | 'expired'
  | 'invalid_payload';

export type OAuthStateVerifyResult<T extends Record<string, string>> =
  | { ok: true; payload: T }
  | { ok: false; reason: OAuthStateVerifyFailureReason };

/**
 * Verify HMAC-signed OAuth state.
 * Rejects missing/malformed/unsigned/invalid/expired payloads.
 * Does not trust client-supplied fields without a valid signature.
 */
export function verifyOAuthState<T extends Record<string, string>>(
  stateValue: string | null | undefined,
  options?: {
    maxAgeMs?: number;
    requiredFields?: string[];
  }
): OAuthStateVerifyResult<T> {
  if (!stateValue) {
    return { ok: false, reason: 'missing' };
  }

  const secret = getOAuthStateSecret();
  if (!secret) {
    return { ok: false, reason: 'missing_secret' };
  }

  let parsed: { payload?: Partial<T>; signature?: string };
  try {
    const raw = Buffer.from(stateValue, 'base64url').toString('utf-8');
    parsed = JSON.parse(raw) as { payload?: Partial<T>; signature?: string };
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: 'malformed' };
  }

  if (!parsed.payload || typeof parsed.payload !== 'object') {
    return { ok: false, reason: 'malformed' };
  }

  if (!parsed.signature || typeof parsed.signature !== 'string') {
    return { ok: false, reason: 'unsigned' };
  }

  const payloadJson = JSON.stringify(parsed.payload);
  const expectedSignature = createHmac('sha256', secret).update(payloadJson).digest('hex');

  const received = Buffer.from(parsed.signature, 'utf-8');
  const expected = Buffer.from(expectedSignature, 'utf-8');

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { ok: false, reason: 'invalid_signature' };
  }

  const requiredFields = options?.requiredFields || [];
  for (const field of requiredFields) {
    const value = (parsed.payload as Record<string, unknown>)[field];
    if (typeof value !== 'string' || !value.trim()) {
      return { ok: false, reason: 'invalid_payload' };
    }
  }

  const tsRaw = String((parsed.payload as Record<string, unknown>).ts || '');
  const ts = Number(tsRaw);
  if (!Number.isFinite(ts) || ts <= 0) {
    return { ok: false, reason: 'invalid_payload' };
  }

  const maxAgeMs = options?.maxAgeMs ?? OAUTH_STATE_MAX_AGE_MS;
  const ageMs = Date.now() - ts;
  if (ageMs < 0 || ageMs > maxAgeMs) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, payload: parsed.payload as T };
}
