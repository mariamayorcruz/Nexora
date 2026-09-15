import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/crypto';
import { getPaymentAdapter, type PaymentCredentials } from '@/lib/payments';
import { resolveAppBaseUrlFromEnv } from '@/lib/app-base-url';

export interface CheckoutLinkResult {
  ok: boolean;
  url?: string;
  orderId?: string;
  error?: string;
}

function decryptCredentials(raw: unknown): PaymentCredentials {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: PaymentCredentials = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string') {
      out[key] = decryptSecret(value) || value;
    }
  }
  return out;
}

/**
 * Crea la orden y el link de pago del negocio (el dinero va a su cuenta).
 * Devuelve el link listo para enviar por WhatsApp.
 */
export async function createCheckoutLink(params: {
  userId: string;
  productId: string;
  leadId?: string | null;
  buyerEmail?: string | null;
  couponId?: string | null;
}): Promise<CheckoutLinkResult> {
  const [product, account] = await Promise.all([
    prisma.product.findFirst({ where: { id: params.productId, userId: params.userId, active: true } }),
    prisma.paymentAccount.findFirst({
      where: { userId: params.userId, connected: true },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    }),
  ]);

  if (!product) return { ok: false, error: 'El producto no existe o está inactivo.' };
  if (!account) return { ok: false, error: 'El negocio todavía no conectó su cuenta de cobro.' };

  const adapter = getPaymentAdapter(account.provider);
  if (!adapter) return { ok: false, error: `Proveedor de pago no soportado: ${account.provider}` };

  let amount = product.price;
  let coupon = null as Awaited<ReturnType<typeof prisma.coupon.findFirst>> | null;
  if (params.couponId) {
    coupon = await prisma.coupon.findFirst({
      where: { id: params.couponId, userId: params.userId, redeemedAt: null, expiresAt: { gt: new Date() } },
    });
    if (coupon) {
      amount = Math.max(0, amount - (amount * coupon.percentOff) / 100);
    }
  }

  const reference = `nx_${crypto.randomBytes(10).toString('hex')}`;
  const baseUrl = resolveAppBaseUrlFromEnv();

  const order = await prisma.order.create({
    data: {
      userId: params.userId,
      leadId: params.leadId || null,
      productId: product.id,
      couponId: coupon?.id || null,
      provider: account.provider,
      reference,
      amount,
      currency: product.currency,
      status: 'pending',
    },
  });

  const link = await adapter.createPaymentLink({
    provider: adapter.provider,
    credentials: decryptCredentials(account.credentials),
    amount,
    currency: product.currency,
    description: product.name,
    reference,
    buyerEmail: params.buyerEmail || null,
    returnUrl: `${baseUrl}/pago/gracias?ref=${reference}`,
    notifyUrl: `${baseUrl}/api/payments/webhook/${account.provider}?u=${params.userId}`,
  });

  if (!link.ok || !link.url) {
    await prisma.order.update({ where: { id: order.id }, data: { status: 'failed' } });
    return { ok: false, error: link.error || 'No se pudo crear el link de pago.' };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentUrl: link.url, providerRef: link.providerRef || null },
  });

  return { ok: true, url: link.url, orderId: order.id };
}
