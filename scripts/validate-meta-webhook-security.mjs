#!/usr/bin/env node
/**
 * ============================================================================
 * ALGORITHM / CONTRACT SMOKE CHECK ONLY — NOT A PRODUCTION IMPLEMENTATION TEST
 * ============================================================================
 *
 * This script INTENTIONALLY reimplements a minimal copy of the Meta webhook
 * HMAC + n8n payload contract for local sanity checks.
 *
 * It does NOT import or execute:
 *   - src/lib/meta-webhook-security.ts
 *   - src/app/api/webhooks/meta-leads/route.ts
 *   - Prisma / database duplicate lookup
 *   - the live n8n forward path
 *
 * Passing this script proves only that the duplicated algorithm/contract
 * sketched here behaves as expected. It does NOT prove the production helpers
 * or route wiring are correct.
 *
 * Real automated coverage of production code remains unimplemented until a
 * proper test runner (Jest/Vitest) is introduced in a later foundation phase.
 *
 * Run: node scripts/validate-meta-webhook-security.mjs
 */
import crypto from 'crypto';
import assert from 'assert';

/** Local duplicate of verifyMetaWebhookSignature — NOT the production export. */
function smokeVerifyMetaWebhookSignature({ rawBody, signatureHeader, appSecret }) {
  const secret = String(appSecret || '').trim();
  if (!secret) return { ok: false, reason: 'missing_secret' };

  const header = String(signatureHeader || '').trim();
  if (!header) return { ok: false, reason: 'missing_signature' };

  const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedHeader = `sha256=${expectedHex}`;
  const provided = Buffer.from(header);
  const expected = Buffer.from(expectedHeader);
  if (provided.length !== expected.length) return { ok: false, reason: 'invalid_signature' };
  if (!crypto.timingSafeEqual(provided, expected)) return { ok: false, reason: 'invalid_signature' };
  return { ok: true };
}

/** Local duplicate of buildMetaLeadN8nPayload shape — NOT the production export. */
function smokeBuildMetaLeadN8nPayload(input) {
  const payload = {
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
    channel: input.whatsappConnected ? 'whatsapp' : 'openphone',
    whatsappConnected: Boolean(input.whatsappConnected),
    openPhoneConnected: Boolean(input.openPhoneConnected),
    whatsappPhoneNumberId: input.whatsappPhoneNumberId || '',
    openPhoneNumberId: input.openPhoneNumberId || '',
  };

  const forbidden = [
    'whatsappAccessToken',
    'openPhoneApiKey',
    'metaAdsToken',
    'accessToken',
    'refreshToken',
    'apiKey',
    'authToken',
    'password',
  ];
  for (const key of forbidden) {
    assert.ok(!Object.prototype.hasOwnProperty.call(payload, key), `secret field present: ${key}`);
  }
  return payload;
}

function smokeBuildMetaLeadIdNoteMarker(id) {
  return `Meta Lead ID: ${id}`;
}

const APP_SECRET = 'test-meta-app-secret-for-smoke-only';
const rawBody = JSON.stringify({
  entry: [{ id: 'act_123', changes: [{ value: { leadgen_id: 'lead_abc', form_id: 'form_1' } }] }],
});

// Contract: missing signature → reject
assert.strictEqual(
  smokeVerifyMetaWebhookSignature({ rawBody, signatureHeader: null, appSecret: APP_SECRET }).reason,
  'missing_signature'
);

// Contract: invalid signature → reject
assert.strictEqual(
  smokeVerifyMetaWebhookSignature({
    rawBody,
    signatureHeader: 'sha256=deadbeef',
    appSecret: APP_SECRET,
  }).reason,
  'invalid_signature'
);

// Contract: valid HMAC-SHA256 header shape → accept (local algorithm only)
const validSig =
  'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');
assert.strictEqual(
  smokeVerifyMetaWebhookSignature({ rawBody, signatureHeader: validSig, appSecret: APP_SECRET }).ok,
  true
);

// Contract: fail closed without app secret
assert.strictEqual(
  smokeVerifyMetaWebhookSignature({ rawBody, signatureHeader: validSig, appSecret: '' }).reason,
  'missing_secret'
);

// Contract: note marker string shape used for TEMPORARY idempotency
const marker = smokeBuildMetaLeadIdNoteMarker('lead_abc');
assert.strictEqual(marker, 'Meta Lead ID: lead_abc');

// Conceptual duplicate decision only — NOT Prisma findFirst / route behavior
const processed = new Set();
function conceptualProcessOnce(metaLeadId) {
  if (processed.has(metaLeadId)) return { created: false, n8n: false, duplicate: true };
  processed.add(metaLeadId);
  return { created: true, n8n: true, duplicate: false };
}
assert.deepStrictEqual(conceptualProcessOnce('lead_abc'), { created: true, n8n: true, duplicate: false });
assert.deepStrictEqual(conceptualProcessOnce('lead_abc'), { created: false, n8n: false, duplicate: true });

// Contract: n8n payload shape must not include credential field names
const n8nPayload = smokeBuildMetaLeadN8nPayload({
  userId: 'user_1',
  crmLeadId: 'crm_1',
  metaLeadId: 'lead_abc',
  metaFormId: 'form_1',
  metaAdAccountId: 'act_123',
  leadName: 'Test Lead',
  leadPhone: '+15555550100',
  leadEmail: 'lead@example.com',
  businessName: 'Demo Co',
  welcomeMessage: 'Hello',
  qualificationPrompt: 'Ask budget',
  aiTone: 'professional',
  language: 'es',
  hotLeadAction: 'notify',
  warmLeadAction: 'sequence',
  coldLeadAction: 'sequence',
  whatsappConnected: true,
  openPhoneConnected: false,
  whatsappPhoneNumberId: 'pnid_1',
  openPhoneNumberId: '',
});
assert.strictEqual(n8nPayload.channel, 'whatsapp');
assert.ok(!('whatsappAccessToken' in n8nPayload));
assert.ok(!('openPhoneApiKey' in n8nPayload));
assert.ok(!('metaAdsToken' in n8nPayload));

console.log(
  'ALGORITHM/CONTRACT SMOKE CHECK PASSED — does not execute production helpers, route, Prisma, or n8n.'
);
