import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/crypto';
import { getPaymentAdapter, type PaymentCredentials } from '@/lib/payments';
import { sendWhatsAppText, normalizePhone } from '@/lib/whatsapp';
import { recordAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

function decryptCredentials(raw: unknown): PaymentCredentials {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: PaymentCredentials = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string') out[key] = decryptSecret(value) || value;
  }
  return out;
}

export async function POST(request: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider;
  const adapter = getPaymentAdapter(provider);
  if (!adapter) return NextResponse.json({ error: 'Unsupported provider' }, { status: 404 });

  const userId = request.nextUrl.searchParams.get('u');
  if (!userId) return NextResponse.json({ error: 'Missing tenant' }, { status: 400 });

  const account = await prisma.paymentAccount.findFirst({ where: { userId, provider } });
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const rawBody = await request.text();
  const event = await adapter.verifyWebhook({
    credentials: decryptCredentials(account.credentials),
    rawBody,
    headers: request.headers,
  });

  if (!event.ok || !event.reference) {
    return NextResponse.json({ error: event.error || 'Invalid webhook' }, { status: 400 });
  }

  const order = await prisma.order.findFirst({ where: { reference: event.reference, userId } });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.status === 'paid') return NextResponse.json({ ok: true, alreadyProcessed: true });

  const paid = event.status === 'paid';
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: paid ? 'paid' : event.status === 'pending' ? 'pending' : 'failed',
      paidAt: paid ? new Date() : null,
      providerRef: event.providerRef || order.providerRef,
    },
  });

  await recordAudit({
    userId,
    action: `payment.${event.status}`,
    entity: 'order',
    entityId: order.id,
    headers: request.headers,
    meta: { provider, amount: order.amount, currency: order.currency },
  });

  if (paid) {
    if (order.couponId) {
      await prisma.coupon.updateMany({
        where: { id: order.couponId, redeemedAt: null },
        data: { redeemedAt: new Date() },
      });
    }

    if (order.leadId) {
      await prisma.crmLead.update({
        where: { id: order.leadId },
        data: { status: 'ganado', stage: 'won', value: order.amount, lastContactedAt: new Date() },
      });

      const [lead, config] = await Promise.all([
        prisma.crmLead.findUnique({ where: { id: order.leadId } }),
        prisma.tenantAutomationConfig.findUnique({ where: { userId } }),
      ]);

      const token = decryptSecret(config?.whatsappAccessToken);
      const phoneNumberId = config?.whatsappPhoneNumberId?.trim();
      const to = normalizePhone(lead?.phone);
      if (token && phoneNumberId && to) {
        const firstName = (lead?.name || '').trim().split(/\s+/)[0] || '';
        await sendWhatsAppText({
          phoneNumberId,
          accessToken: token,
          to,
          body: `¡Gracias ${firstName}! 🎉 Recibimos tu pago. En un momento te contactamos para coordinar todo.`,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, status: event.status });
}
