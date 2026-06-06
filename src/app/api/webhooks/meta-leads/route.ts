import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type MetaFieldData = {
  name?: string;
  values?: unknown[];
};

type ExtractedMetaLead = {
  leadId: string;
  formId: string;
  adAccountId: string;
  name: string;
  email: string;
  phone: string;
  fieldData: MetaFieldData[];
};

function firstString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return firstString(value[0]);
  return '';
}

function normalizeFieldName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_');
}

function valueFromFieldData(fieldData: MetaFieldData[], names: string[]) {
  const targets = new Set(names.map(normalizeFieldName));
  const match = fieldData.find((field) => targets.has(normalizeFieldName(String(field.name || ''))));
  return firstString(match?.values);
}

function collectFieldData(value: Record<string, unknown>) {
  const candidates = [value.field_data, value.fieldData, value.fields];
  const fieldData = candidates.find(Array.isArray) as MetaFieldData[] | undefined;
  return fieldData || [];
}

function normalizeAdAccountId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
}

function extractLeadFromPayload(payload: unknown): ExtractedMetaLead {
  const root = (payload || {}) as Record<string, unknown>;
  const entry = Array.isArray(root.entry) ? (root.entry[0] as Record<string, unknown> | undefined) : undefined;
  const change = Array.isArray(entry?.changes) ? (entry?.changes[0] as Record<string, unknown> | undefined) : undefined;
  const value = ((change?.value || root.value || root) || {}) as Record<string, unknown>;
  const fieldData = collectFieldData(value);

  const leadId = firstString(value.leadgen_id || value.leadId || value.lead_id || root.leadId);
  const formId = firstString(value.form_id || value.formId || root.formId);
  const adAccountId = firstString(
    value.ad_account_id ||
      value.adAccountId ||
      value.account_id ||
      value.accountId ||
      entry?.id ||
      root.adAccountId
  );
  const name =
    valueFromFieldData(fieldData, ['full_name', 'name', 'nombre', 'first_name']) ||
    firstString(value.name || value.full_name || value.nombre || root.name);
  const email =
    valueFromFieldData(fieldData, ['email', 'correo', 'correo_electronico']) ||
    firstString(value.email || root.email);
  const phone =
    valueFromFieldData(fieldData, ['phone_number', 'phone', 'telefono', 'teléfono', 'mobile_phone']) ||
    firstString(value.phone || value.phone_number || value.telefono || root.phone);

  return {
    leadId,
    formId,
    adAccountId,
    name,
    email,
    phone,
    fieldData,
  };
}

async function fetchMetaLeadDetails(leadId: string, accessToken: string): Promise<Partial<ExtractedMetaLead>> {
  if (!leadId || !accessToken) return {};

  const url = new URL(`https://graph.facebook.com/v19.0/${leadId}`);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('fields', 'field_data,form_id,ad_id,created_time');

  const response = await fetch(url, { cache: 'no-store' });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok || !payload) {
    console.error('Meta lead details fetch failed', {
      leadId,
      status: response.status,
      payload,
    });
    return {};
  }

  const fieldData = collectFieldData(payload);

  return {
    formId: firstString(payload.form_id),
    name: valueFromFieldData(fieldData, ['full_name', 'name', 'nombre', 'first_name']),
    email: valueFromFieldData(fieldData, ['email', 'correo', 'correo_electronico']),
    phone: valueFromFieldData(fieldData, ['phone_number', 'phone', 'telefono', 'teléfono', 'mobile_phone']),
    fieldData,
  };
}

function mergeLeadDetails(lead: ExtractedMetaLead, details: Partial<ExtractedMetaLead>): ExtractedMetaLead {
  return {
    ...lead,
    formId: lead.formId || details.formId || '',
    name: lead.name || details.name || '',
    email: lead.email || details.email || '',
    phone: lead.phone || details.phone || '',
    fieldData: lead.fieldData.length ? lead.fieldData : details.fieldData || [],
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const verifyToken = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge') || '';

  if (mode === 'subscribe' && verifyToken === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response('Forbidden', { status: 403 });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const extractedLead = extractLeadFromPayload(payload);
    const adAccountId = extractedLead.adAccountId;

    if (!extractedLead.leadId || !adAccountId) {
      console.error('Meta lead webhook missing required identifiers', {
        leadId: extractedLead.leadId,
        adAccountId,
        payload,
      });
      return NextResponse.json({ error: 'Missing leadId or adAccountId' }, { status: 400 });
    }

    const normalizedAdAccountId = normalizeAdAccountId(adAccountId);
    const config = await prisma.tenantAutomationConfig.findFirst({
      where: {
        OR: [
          { metaAdsAccountId: adAccountId },
          { metaAdsAccountId: normalizedAdAccountId },
          { metaAdsAccountId: adAccountId.replace(/^act_/, '') },
        ],
      },
    });

    if (!config) {
      console.error('Meta lead webhook tenant config not found', {
        leadId: extractedLead.leadId,
        adAccountId,
        normalizedAdAccountId,
      });
      return NextResponse.json({ error: 'Tenant automation config not found' }, { status: 404 });
    }

    const metaDetails = await fetchMetaLeadDetails(extractedLead.leadId, config.metaAdsToken || '');
    const lead = mergeLeadDetails(extractedLead, metaDetails);
    const leadName = lead.name || `Meta Lead ${lead.leadId}`;

    const crmLead = await prisma.crmLead.create({
      data: {
        userId: config.userId,
        name: leadName,
        email: lead.email || null,
        phone: lead.phone || null,
        source: 'meta_lead_ads',
        stage: 'lead',
        status: 'nuevo',
        notes: [
          `Meta Lead ID: ${lead.leadId}`,
          lead.formId ? `Meta Form ID: ${lead.formId}` : null,
          `Meta Ad Account ID: ${adAccountId}`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    });

    if (config.n8nWebhookUrl) {
      const channel = config.whatsappConnected ? 'whatsapp' : 'openphone';

      try {
        const n8nResponse = await fetch(config.n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: config.userId,
            leadId: crmLead.id,
            leadName,
            leadPhone: lead.phone,
            leadEmail: lead.email,
            businessName: config.businessName || '',
            welcomeMessage: config.welcomeMessage || '',
            qualificationPrompt: config.qualificationPrompt || '',
            aiTone: config.aiTone,
            language: config.language,
            hotLeadAction: config.hotLeadAction,
            warmLeadAction: config.warmLeadAction,
            coldLeadAction: config.coldLeadAction,
            whatsappPhoneNumberId: config.whatsappPhoneNumberId || '',
            whatsappAccessToken: config.whatsappAccessToken || '',
            openPhoneApiKey: config.openPhoneApiKey || '',
            channel,
          }),
        });

        if (!n8nResponse.ok) {
          console.error('n8n webhook returned non-OK for Meta lead', {
            userId: config.userId,
            crmLeadId: crmLead.id,
            metaLeadId: lead.leadId,
            n8nWebhookUrl: config.n8nWebhookUrl,
            status: n8nResponse.status,
          });
        }
      } catch (n8nError) {
        console.error('n8n webhook failed for Meta lead', {
          userId: config.userId,
          crmLeadId: crmLead.id,
          metaLeadId: lead.leadId,
          n8nWebhookUrl: config.n8nWebhookUrl,
          error: n8nError,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Meta lead webhook failed', { error });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
