import crypto from 'crypto';
import { resolveMetaClientSecret } from '@/lib/meta-ads';

/**
 * TEMPORARY application-level Meta lead idempotency marker stored in CrmLead.notes.
 * Later foundation work should add a dedicated unique externalLeadId (or equivalent)
 * column/index and stop relying on notes.contains matching.
 */
export const META_LEAD_ID_NOTE_PREFIX = 'Meta Lead ID:';

export function buildMetaLeadIdNoteMarker(metaLeadId: string): string {
  return `${META_LEAD_ID_NOTE_PREFIX} ${String(metaLeadId || '').trim()}`;
}

export function getMetaWebhookAppSecret(): string {
  return resolveMetaClientSecret();
}

/**
 * Meta signs POST bodies with HMAC-SHA256 using the App Secret and sends
 * `X-Hub-Signature-256: sha256=<hex>` (official Meta webhook docs).
 * Must be computed over the raw request body bytes/string as received.
 */
export function verifyMetaWebhookSignature(params: {
  rawBody: string | Buffer;
  signatureHeader: string | null | undefined;
  appSecret: string;
}): { ok: true } | { ok: false; reason: 'missing_secret' | 'missing_signature' | 'invalid_signature' } {
  const appSecret = String(params.appSecret || '').trim();
  if (!appSecret) {
    return { ok: false, reason: 'missing_secret' };
  }

  const header = String(params.signatureHeader || '').trim();
  if (!header) {
    return { ok: false, reason: 'missing_signature' };
  }

  const expectedHex = crypto.createHmac('sha256', appSecret).update(params.rawBody).digest('hex');
  const expectedHeader = `sha256=${expectedHex}`;

  const provided = Buffer.from(header);
  const expected = Buffer.from(expectedHeader);

  if (provided.length !== expected.length) {
    return { ok: false, reason: 'invalid_signature' };
  }

  if (!crypto.timingSafeEqual(provided, expected)) {
    return { ok: false, reason: 'invalid_signature' };
  }

  return { ok: true };
}

export type MetaN8nForwardPayload = {
  userId: string;
  leadId: string;
  metaLeadId: string;
  metaFormId: string;
  metaAdAccountId: string;
  leadName: string;
  leadPhone: string | null;
  leadEmail: string | null;
  businessName: string;
  welcomeMessage: string;
  qualificationPrompt: string;
  aiTone: string;
  language: string;
  hotLeadAction: string;
  warmLeadAction: string;
  coldLeadAction: string;
  channel: 'whatsapp' | 'openphone';
  whatsappConnected: boolean;
  openPhoneConnected: boolean;
  /** Non-secret Meta phone number id (not an access token). */
  whatsappPhoneNumberId: string;
  openPhoneNumberId: string;
};

const FORBIDDEN_N8N_SECRET_KEYS = [
  'whatsappAccessToken',
  'openPhoneApiKey',
  'metaAdsToken',
  'accessToken',
  'refreshToken',
  'apiKey',
  'authToken',
  'password',
] as const;

export function assertNoSecretFieldsInN8nPayload(payload: Record<string, unknown>) {
  for (const key of FORBIDDEN_N8N_SECRET_KEYS) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      throw new Error(`n8n payload must not include secret field: ${key}`);
    }
  }
}

/**
 * Builds the Meta → n8n forward body without credential material.
 * Downstream n8n workflows must use their own credential store for channel APIs.
 */
export function buildMetaLeadN8nPayload(input: {
  userId: string;
  crmLeadId: string;
  metaLeadId: string;
  metaFormId?: string | null;
  metaAdAccountId: string;
  leadName: string;
  leadPhone?: string | null;
  leadEmail?: string | null;
  businessName?: string | null;
  welcomeMessage?: string | null;
  qualificationPrompt?: string | null;
  aiTone: string;
  language: string;
  hotLeadAction: string;
  warmLeadAction: string;
  coldLeadAction: string;
  whatsappConnected: boolean;
  openPhoneConnected: boolean;
  whatsappPhoneNumberId?: string | null;
  openPhoneNumberId?: string | null;
}): MetaN8nForwardPayload {
  const channel: 'whatsapp' | 'openphone' = input.whatsappConnected ? 'whatsapp' : 'openphone';

  const payload: MetaN8nForwardPayload = {
    userId: input.userId,
    leadId: input.crmLeadId,
    metaLeadId: input.metaLeadId,
    metaFormId: input.metaFormId || '',
    metaAdAccountId: input.metaAdAccountId,
    leadName: input.leadName,
    leadPhone: input.leadPhone || null,
    leadEmail: input.leadEmail || null,
    businessName: input.businessName || '',
    welcomeMessage: input.welcomeMessage || '',
    qualificationPrompt: input.qualificationPrompt || '',
    aiTone: input.aiTone,
    language: input.language,
    hotLeadAction: input.hotLeadAction,
    warmLeadAction: input.warmLeadAction,
    coldLeadAction: input.coldLeadAction,
    channel,
    whatsappConnected: Boolean(input.whatsappConnected),
    openPhoneConnected: Boolean(input.openPhoneConnected),
    whatsappPhoneNumberId: input.whatsappPhoneNumberId || '',
    openPhoneNumberId: input.openPhoneNumberId || '',
  };

  assertNoSecretFieldsInN8nPayload(payload as unknown as Record<string, unknown>);
  return payload;
}
