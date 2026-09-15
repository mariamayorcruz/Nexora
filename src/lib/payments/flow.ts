import crypto from 'crypto';
import type {
  CreatePaymentLinkInput,
  CreatePaymentLinkResult,
  PaymentAdapter,
  VerifyWebhookInput,
  WebhookEvent,
} from '@/lib/payments/types';

/**
 * Flow.cl — pasarela chilena (Webpay, transferencia, débito).
 * La firma es HMAC-SHA256 de los parámetros ordenados alfabéticamente.
 */
const FLOW_API = process.env.FLOW_API_URL || 'https://www.flow.cl/api';

function signParams(params: Record<string, string>, secretKey: string): string {
  const keys = Object.keys(params).sort();
  const toSign = keys.map((key) => `${key}${params[key]}`).join('');
  return crypto.createHmac('sha256', secretKey).update(toSign).digest('hex');
}

export const flowAdapter: PaymentAdapter = {
  provider: 'flow',

  async createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResult> {
    const apiKey = input.credentials.apiKey;
    const secretKey = input.credentials.secretKey;
    if (!apiKey || !secretKey) {
      return { ok: false, error: 'Faltan las credenciales de Flow.' };
    }

    const params: Record<string, string> = {
      apiKey,
      commerceOrder: input.reference,
      subject: input.description.slice(0, 250),
      currency: input.currency,
      amount: String(Math.round(input.amount)),
      email: input.buyerEmail || 'sinmail@gotnexora.com',
      urlConfirmation: input.notifyUrl,
      urlReturn: input.returnUrl,
    };
    params.s = signParams(params, secretKey);

    try {
      const response = await fetch(`${FLOW_API}/payment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
      });
      const data = (await response.json()) as { url?: string; token?: string; message?: string };
      if (!response.ok || !data.url || !data.token) {
        return { ok: false, error: data.message || `Flow respondió ${response.status}` };
      }
      return { ok: true, url: `${data.url}?token=${data.token}`, providerRef: data.token };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Error de red con Flow' };
    }
  },

  async verifyWebhook(input: VerifyWebhookInput): Promise<WebhookEvent> {
    const apiKey = input.credentials.apiKey;
    const secretKey = input.credentials.secretKey;
    if (!apiKey || !secretKey) {
      return { ok: false, error: 'Faltan las credenciales de Flow.' };
    }

    const token = new URLSearchParams(input.rawBody).get('token');
    if (!token) return { ok: false, error: 'Webhook de Flow sin token.' };

    // Flow no firma el callback: el estado se confirma consultando su API.
    const params: Record<string, string> = { apiKey, token };
    params.s = signParams(params, secretKey);

    try {
      const response = await fetch(`${FLOW_API}/payment/getStatus?${new URLSearchParams(params).toString()}`);
      const data = (await response.json()) as {
        status?: number;
        commerceOrder?: string;
        amount?: number;
        currency?: string;
        message?: string;
      };
      if (!response.ok) {
        return { ok: false, error: data.message || `Flow respondió ${response.status}` };
      }
      const status = data.status === 2 ? 'paid' : data.status === 1 ? 'pending' : 'failed';
      return {
        ok: true,
        providerRef: token,
        reference: data.commerceOrder,
        status,
        amount: data.amount,
        currency: data.currency,
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Error de red con Flow' };
    }
  },
};
