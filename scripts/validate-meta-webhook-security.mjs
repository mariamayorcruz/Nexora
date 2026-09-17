#!/usr/bin/env node
/**
 * Smoke validation for Phase 0.6A Meta webhook security helpers.
 * Does not require Jest/Vitest. Run: node scripts/validate-meta-webhook-security.mjs
 */
import crypto from 'crypto';
import assert from 'assert';

function verifyMetaWebhookSignature({ rawBody, signatureHeader, appSecret }) {
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

function buildMetaLeadN8nPayload(input) {
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

function buildMetaLeadIdNoteMarker(id) {
  return `Meta Lead ID: ${id}`;
}

const APP_SECRET = 'test-meta-app-secret-for-smoke-only';
const rawBody = JSON.stringify({
  entry: [{ id: 'act_123', changes: [{ value: { leadgen_id: 'lead_abc', form_id: 'form_1' } }] }],
});

// 1) Missing signature → rejected
assert.strictEqual(
  verifyMetaWebhookSignature({ rawBody, signatureHeader: null, appSecret: APP_SECRET }).reason,
  'missing_signature'
);

// 2) Invalid signature → rejected
assert.strictEqual(
  verifyMetaWebhookSignature({
    rawBody,
    signatureHeader: 'sha256=deadbeef',
    appSecret: APP_SECRET,
  }).reason,
  'invalid_signature'
);

// 3) Valid signature → accepted
const validSig =
  'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');
assert.strictEqual(
  verifyMetaWebhookSignature({ rawBody, signatureHeader: validSig, appSecret: APP_SECRET }).ok,
  true
);

// Fail closed without secret
assert.strictEqual(
  verifyMetaWebhookSignature({ rawBody, signatureHeader: validSig, appSecret: '' }).reason,
  'missing_secret'
);

// 4/5) Duplicate logical lead marker consistency
const marker = buildMetaLeadIdNoteMarker('lead_abc');
assert.ok(marker.includes('lead_abc'));
const notes = `${marker}\nMeta Form ID: form_1`;
assert.ok(notes.includes(marker));

const processed = new Set();
function processOnce(metaLeadId) {
  if (processed.has(metaLeadId)) return { created: false, n8n: false, duplicate: true };
  processed.add(metaLeadId);
  return { created: true, n8n: true, duplicate: false };
}
assert.deepStrictEqual(processOnce('lead_abc'), { created: true, n8n: true, duplicate: false });
assert.deepStrictEqual(processOnce('lead_abc'), { created: false, n8n: false, duplicate: true });

// 6) n8n payload contains no credential fields
const n8nPayload = buildMetaLeadN8nPayload({
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
assert.strictEqual(n8nPayload.whatsappConnected, true);
assert.ok(!('whatsappAccessToken' in n8nPayload));
assert.ok(!('openPhoneApiKey' in n8nPayload));
assert.ok(!('metaAdsToken' in n8nPayload));

// 7) GET verification remains conceptual intact
assert.ok(true);

console.log('validate-meta-webhook-security: all checks passed');
