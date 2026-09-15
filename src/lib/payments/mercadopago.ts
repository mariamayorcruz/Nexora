import type {
  CreatePaymentLinkInput,
  CreatePaymentLinkResult,
  PaymentAdapter,
  VerifyWebhookInput,
  WebhookEvent,
} from '@/lib/payments/types';

const MP_API = process.env.MERCADOPAGO_API_URL || 'https://api.mercadopago.com';

export const mercadoPagoAdapter: PaymentAdapter = {
  provider: 'mercadopago',

  async createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResult> {
    const accessToken = input.credentials.accessToken;
    if (!accessToken) return { ok: false, error: 'Falta el token de Mercado Pago.' };

    try {
      const response = await fetch(`${MP_API}/checkout/preferences`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              title: input.description.slice(0, 250),
              quantity: 1,
              unit_price: Number(input.amount),
              currency_id: input.currency,
            },
          ],
          external_reference: input.reference,
          payer: input.buyerEmail ? { email: input.buyerEmail } : undefined,
          back_urls: { success: input.returnUrl, pending: input.returnUrl, failure: input.returnUrl },
          notification_url: input.notifyUrl,
        }),
      });

      const data = (await response.json()) as {
        id?: string;
        init_point?: string;
        message?: string;
      };
      if (!response.ok || !data.init_point) {
        return { ok: false, error: data.message || `Mercado Pago respondió ${response.status}` };
      }
      return { ok: true, url: data.init_point, providerRef: data.id };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Error de red con Mercado Pago' };
    }
  },

  async verifyWebhook(input: VerifyWebhookInput): Promise<WebhookEvent> {
    const accessToken = input.credentials.accessToken;
    if (!accessToken) return { ok: false, error: 'Falta el token de Mercado Pago.' };

    let paymentId = '';
    try {
      const payload = JSON.parse(input.rawBody || '{}') as {
        data?: { id?: string | number };
        id?: string | number;
        type?: string;
      };
      paymentId = String(payload.data?.id ?? payload.id ?? '');
    } catch {
      return { ok: false, error: 'Webhook de Mercado Pago ilegible.' };
    }
    if (!paymentId) return { ok: false, error: 'Webhook de Mercado Pago sin id de pago.' };

    try {
      // El estado real siempre se confirma contra la API, nunca desde el body.
      const response = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = (await response.json()) as {
        status?: string;
        external_reference?: string;
        transaction_amount?: number;
        currency_id?: string;
        message?: string;
      };
      if (!response.ok) {
        return { ok: false, error: data.message || `Mercado Pago respondió ${response.status}` };
      }
      const status =
        data.status === 'approved' ? 'paid' : data.status === 'pending' || data.status === 'in_process' ? 'pending' : 'failed';
      return {
        ok: true,
        providerRef: paymentId,
        reference: data.external_reference,
        status,
        amount: data.transaction_amount,
        currency: data.currency_id,
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Error de red con Mercado Pago' };
    }
  },
};
