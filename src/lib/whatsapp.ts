import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/crypto';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v19.0';

export type WhatsAppSendResult = {
  ok: boolean;
  skipped?: 'no-config' | 'inactive' | 'no-credentials' | 'no-phone';
  error?: string;
  messageId?: string;
};

/** E.164-ish normalization: digits only, keeps the country code the user stored. */
export function normalizePhone(raw?: string | null): string {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  return digits.length >= 8 ? digits : '';
}

export async function sendWhatsAppText(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  body: string;
}): Promise<WhatsAppSendResult> {
  const to = normalizePhone(params.to);
  if (!to) return { ok: false, skipped: 'no-phone' };

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${params.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { preview_url: false, body: params.body.slice(0, 4000) },
        }),
      }
    );

    const payload = (await response.json().catch(() => null)) as
      | { messages?: Array<{ id?: string }>; error?: { message?: string } }
      | null;

    if (!response.ok) {
      return { ok: false, error: payload?.error?.message || `HTTP ${response.status}` };
    }

    return { ok: true, messageId: payload?.messages?.[0]?.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'unknown error' };
  }
}

function buildWelcomeMessage(params: {
  leadName: string;
  businessName?: string | null;
  welcomeMessage?: string | null;
  language?: string | null;
}) {
  const firstName = params.leadName.trim().split(/\s+/)[0] || '';
  const business = params.businessName?.trim() || '';

  if (params.welcomeMessage?.trim()) {
    return params.welcomeMessage
      .replaceAll('{{name}}', firstName)
      .replaceAll('{{nombre}}', firstName)
      .replaceAll('{{business}}', business)
      .replaceAll('{{negocio}}', business);
  }

  if (params.language === 'en') {
    return `Hi ${firstName || 'there'}! Thanks for reaching out${business ? ` to ${business}` : ''}. How can we help you today?`;
  }

  return `¡Hola ${firstName || ''}! Gracias por escribirnos${business ? ` a ${business}` : ''}. ¿En qué te podemos ayudar hoy?`;
}

/**
 * Sends the automatic first WhatsApp message for a brand-new lead and records the outcome
 * on the CRM lead. Used by the Meta lead webhook, manual lead creation and web forms.
 */
export async function notifyNewLeadOnWhatsApp(params: {
  userId: string;
  leadId: string;
  leadName: string;
  leadPhone?: string | null;
}): Promise<WhatsAppSendResult> {
  const config = await prisma.tenantAutomationConfig.findUnique({
    where: { userId: params.userId },
  });

  if (!config) return { ok: false, skipped: 'no-config' };
  if (!config.automationActive || !config.whatsappConnected) return { ok: false, skipped: 'inactive' };

  const phoneNumberId = config.whatsappPhoneNumberId?.trim();
  const accessToken = decryptSecret(config.whatsappAccessToken);
  if (!phoneNumberId || !accessToken) return { ok: false, skipped: 'no-credentials' };

  const to = normalizePhone(params.leadPhone);
  if (!to) return { ok: false, skipped: 'no-phone' };

  const result = await sendWhatsAppText({
    phoneNumberId,
    accessToken,
    to,
    body: buildWelcomeMessage({
      leadName: params.leadName,
      businessName: config.businessName,
      welcomeMessage: config.welcomeMessage,
      language: config.language,
    }),
  });

  try {
    const lead = await prisma.crmLead.findUnique({ where: { id: params.leadId } });
    if (lead) {
      const stamp = new Date().toISOString();
      const note = result.ok
        ? `[${stamp}] WhatsApp de bienvenida enviado automáticamente.`
        : `[${stamp}] Fallo el WhatsApp automático: ${result.error || result.skipped || 'desconocido'}`;

      await prisma.crmLead.update({
        where: { id: params.leadId },
        data: {
          notes: [lead.notes, note].filter(Boolean).join('\n'),
          ...(result.ok ? { status: 'contactado', lastContactedAt: new Date() } : {}),
        },
      });
    }
  } catch (error) {
    console.error('Failed to record WhatsApp outcome on lead', { leadId: params.leadId, error });
  }

  return result;
}
