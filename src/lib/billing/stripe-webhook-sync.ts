import { Prisma, PrismaClient } from '@prisma/client';
import type Stripe from 'stripe';
import { resolvePlanFromStripePriceId } from '@/lib/billing';
import { assertUnixSeconds, compatibilityMajorAmount } from '@/lib/billing/money';
import { onPayingSubscriptionSynced } from '@/lib/conversion-automation';
import { prisma } from '@/lib/prisma';
import { syncPaidLeadCapturesForAdmin } from '@/lib/stripe-funnel-sync';

type Db = PrismaClient;

const SUPPORTED_INTERVALS = new Set(['day', 'week', 'month', 'year']);

export class StripeWebhookProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeWebhookProcessingError';
  }
}

export type StripeWebhookProcessResult = {
  duplicate: boolean;
  stale: boolean;
};

type ProjectedPrice =
  | {
      ok: true;
      amountMinor: bigint;
      currency: string;
      interval: string;
      intervalCount: number;
      plan: string;
      stripePriceId: string | null;
    }
  | { ok: false };

export function projectSubscriptionPrice(subscription: Stripe.Subscription): ProjectedPrice {
  const items = subscription.items?.data ?? [];
  if (items.length === 0) return { ok: false };

  let currency: string | null = null;
  let interval: string | null = null;
  let intervalCount: number | null = null;
  let amount = 0n;
  const priceIds: string[] = [];
  const plans = new Set<string>();

  for (const item of items) {
    const price = item.price;
    const unit = price?.unit_amount;
    const recurring = price?.recurring;
    if (unit == null || !Number.isInteger(unit) || unit < 0) return { ok: false };
    if (!recurring?.interval || !SUPPORTED_INTERVALS.has(recurring.interval)) return { ok: false };
    const count = recurring.interval_count ?? 1;
    if (!Number.isInteger(count) || count < 1) return { ok: false };
    const quantity = item.quantity == null ? 1 : item.quantity;
    if (!Number.isInteger(quantity) || quantity < 0) return { ok: false };
    const itemCurrency = (price.currency || subscription.currency || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(itemCurrency)) return { ok: false };
    if (currency && currency !== itemCurrency) return { ok: false };
    if (interval && (interval !== recurring.interval || intervalCount !== count)) return { ok: false };
    currency = itemCurrency;
    interval = recurring.interval;
    intervalCount = count;
    amount += BigInt(unit) * BigInt(quantity);
    if (price.id) priceIds.push(price.id);
    plans.add(resolvePlanFromStripePriceId(price.id) ?? 'unrecognized');
  }

  if (!currency || !interval || intervalCount == null) return { ok: false };
  const uniquePriceIds = [...new Set(priceIds)];
  const onlyPlan = plans.size === 1 ? [...plans][0] : undefined;
  return {
    ok: true,
    amountMinor: amount,
    currency,
    interval,
    intervalCount,
    plan: onlyPlan ?? 'unrecognized',
    stripePriceId: uniquePriceIds.length === 1 ? uniquePriceIds[0] ?? null : null,
  };
}

function stripeId(value: string | { id?: string | null } | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.id ?? null;
}

function unixDate(seconds: number | null | undefined, label: string): Date {
  if (seconds == null || !Number.isInteger(seconds)) {
    throw new StripeWebhookProcessingError(`${label} is missing`);
  }
  return new Date(assertUnixSeconds(seconds, label) * 1000);
}

function isStale(stored: number | null | undefined, incoming: number): boolean {
  return stored != null && incoming < stored;
}

type InvoiceProjection = {
  stripeInvoiceId: string;
  stripeCustomerId: string;
  amountMinor: bigint;
  currency: string;
  status: string;
  description: string | null;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date | null;
  paidAt: Date | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  sourceEventCreated: number;
};

function readInvoice(invoice: Stripe.Invoice, sourceEventCreated: number): InvoiceProjection {
  const stripeCustomerId = stripeId(invoice.customer);
  if (!stripeCustomerId) {
    throw new StripeWebhookProcessingError('invoice customer is missing');
  }
  if (!Number.isInteger(invoice.amount_paid) || invoice.amount_paid < 0) {
    throw new StripeWebhookProcessingError('invoice amount_paid must be a non-negative integer minor unit');
  }
  const currency = (invoice.currency || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new StripeWebhookProcessingError('invoice currency must be a 3-letter code');
  }
  const description = invoice.description || invoice.lines?.data?.[0]?.description || null;
  return {
    stripeInvoiceId: invoice.id,
    stripeCustomerId,
    amountMinor: BigInt(invoice.amount_paid),
    currency,
    status: invoice.status || 'open',
    description,
    periodStart: unixDate(invoice.period_start, 'invoice period_start'),
    periodEnd: unixDate(invoice.period_end, 'invoice period_end'),
    dueDate: invoice.due_date ? unixDate(invoice.due_date, 'invoice due_date') : null,
    paidAt:
      invoice.status === 'paid' && invoice.status_transitions?.paid_at
        ? unixDate(invoice.status_transitions.paid_at, 'invoice paid_at')
        : null,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdfUrl: invoice.invoice_pdf ?? null,
    sourceEventCreated,
  };
}

async function writeInvoiceIfNewer(tx: Prisma.TransactionClient, userId: string, projection: InvoiceProjection) {
  const existing = await tx.invoice.findUnique({
    where: { stripeInvoiceId: projection.stripeInvoiceId },
    select: { sourceEventCreated: true },
  });
  if (isStale(existing?.sourceEventCreated, projection.sourceEventCreated)) return;

  const amount = compatibilityMajorAmount(projection.amountMinor, projection.currency);
  const data = {
    amount,
    amountMinor: projection.amountMinor,
    currency: projection.currency,
    description: projection.description,
    status: projection.status,
    periodStart: projection.periodStart,
    periodEnd: projection.periodEnd,
    dueDate: projection.dueDate,
    paidAt: projection.paidAt,
    hostedInvoiceUrl: projection.hostedInvoiceUrl,
    invoicePdfUrl: projection.invoicePdfUrl,
    sourceEventCreated: projection.sourceEventCreated,
  };
  await tx.invoice.upsert({
    where: { stripeInvoiceId: projection.stripeInvoiceId },
    update: data,
    create: {
      userId,
      stripeInvoiceId: projection.stripeInvoiceId,
      ...data,
    },
  });
}

async function savePending(tx: Prisma.TransactionClient, projection: InvoiceProjection) {
  const existing = await tx.pendingStripeInvoice.findUnique({
    where: { stripeInvoiceId: projection.stripeInvoiceId },
    select: { sourceEventCreated: true },
  });
  if (isStale(existing?.sourceEventCreated, projection.sourceEventCreated)) return;
  await tx.pendingStripeInvoice.upsert({
    where: { stripeInvoiceId: projection.stripeInvoiceId },
    update: {
      stripeCustomerId: projection.stripeCustomerId,
      amountMinor: projection.amountMinor,
      currency: projection.currency,
      status: projection.status,
      description: projection.description,
      periodStart: projection.periodStart,
      periodEnd: projection.periodEnd,
      dueDate: projection.dueDate,
      paidAt: projection.paidAt,
      hostedInvoiceUrl: projection.hostedInvoiceUrl,
      invoicePdfUrl: projection.invoicePdfUrl,
      sourceEventCreated: projection.sourceEventCreated,
    },
    create: projection,
  });
}

async function promotePending(tx: Prisma.TransactionClient, userId: string, stripeCustomerId: string) {
  const pending = await tx.pendingStripeInvoice.findMany({ where: { stripeCustomerId } });
  for (const row of pending) {
    await writeInvoiceIfNewer(tx, userId, {
      stripeInvoiceId: row.stripeInvoiceId,
      stripeCustomerId: row.stripeCustomerId,
      amountMinor: row.amountMinor,
      currency: row.currency,
      status: row.status,
      description: row.description,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      dueDate: row.dueDate,
      paidAt: row.paidAt,
      hostedInvoiceUrl: row.hostedInvoiceUrl,
      invoicePdfUrl: row.invoicePdfUrl,
      sourceEventCreated: row.sourceEventCreated,
    });
    await tx.pendingStripeInvoice.delete({ where: { stripeInvoiceId: row.stripeInvoiceId } });
  }
}

async function applySubscription(
  tx: Prisma.TransactionClient,
  subscription: Stripe.Subscription,
  sourceEventCreated: number
): Promise<{ stale: boolean }> {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    throw new StripeWebhookProcessingError('subscription metadata.userId is required');
  }
  const stripeCustomerId = stripeId(subscription.customer);
  if (!stripeCustomerId) {
    throw new StripeWebhookProcessingError('subscription customer is missing');
  }
  if (!subscription.id) {
    throw new StripeWebhookProcessingError('subscription id is missing');
  }

  const existing = await tx.subscription.findUnique({
    where: { userId },
    select: { sourceEventCreated: true },
  });
  const stale = isStale(existing?.sourceEventCreated, sourceEventCreated);
  if (!stale) {
    const projected = projectSubscriptionPrice(subscription);
    const data = {
      plan: projected.ok ? projected.plan : 'unrecognized',
      status: subscription.status,
      stripeStatus: subscription.status,
      currentPeriodStart: unixDate(subscription.current_period_start, 'subscription current_period_start'),
      currentPeriodEnd: unixDate(subscription.current_period_end, 'subscription current_period_end'),
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      stripeCustomerId,
      stripeSubId: subscription.id,
      billingInterval: projected.ok ? projected.interval : null,
      billingIntervalCount: projected.ok ? projected.intervalCount : null,
      recurringAmountMinor: projected.ok ? projected.amountMinor : null,
      currency: projected.ok ? projected.currency : null,
      stripePriceId: projected.ok ? projected.stripePriceId : null,
      sourceEventCreated,
    };
    await tx.subscription.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
    await syncPaidLeadCapturesForAdmin(subscription, tx);
    await onPayingSubscriptionSynced({
      userId,
      stripeSubscriptionStatus: subscription.status,
      db: tx,
    });
  }

  const owner = await tx.subscription.findUnique({
    where: { stripeCustomerId },
    select: { userId: true },
  });
  if (owner) {
    await promotePending(tx, owner.userId, stripeCustomerId);
  }
  return { stale };
}

async function applyInvoice(tx: Prisma.TransactionClient, invoice: Stripe.Invoice, sourceEventCreated: number) {
  const projection = readInvoice(invoice, sourceEventCreated);
  const owner = await tx.subscription.findUnique({
    where: { stripeCustomerId: projection.stripeCustomerId },
    select: { userId: true },
  });
  if (!owner) {
    await savePending(tx, projection);
    return;
  }
  await writeInvoiceIfNewer(tx, owner.userId, projection);
  await tx.pendingStripeInvoice.deleteMany({ where: { stripeInvoiceId: projection.stripeInvoiceId } });
}

async function applyEvent(tx: Prisma.TransactionClient, event: Stripe.Event, subscription?: Stripe.Subscription) {
  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    return applySubscription(tx, event.data.object as Stripe.Subscription, event.created);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const subscriptionId = stripeId(session.subscription);
    if (!subscriptionId) return { stale: false };
    if (!subscription) {
      throw new StripeWebhookProcessingError('checkout subscription must be retrieved before processing');
    }
    return applySubscription(tx, subscription, event.created);
  }

  if (
    event.type === 'invoice.payment_succeeded' ||
    event.type === 'invoice.payment_failed' ||
    event.type === 'invoice.finalized'
  ) {
    await applyInvoice(tx, event.data.object as Stripe.Invoice, event.created);
    return { stale: false };
  }

  return { stale: false };
}

export async function processStripeEvent(
  event: Stripe.Event,
  options?: { subscription?: Stripe.Subscription; db?: Db }
): Promise<StripeWebhookProcessResult> {
  if (!event.id) {
    throw new StripeWebhookProcessingError('stripe event id is required');
  }
  const stripeCreated = assertUnixSeconds(event.created, 'event.created');
  if (typeof event.livemode !== 'boolean') {
    throw new StripeWebhookProcessingError('stripe event livemode is required');
  }
  const db = options?.db ?? prisma;

  return db.$transaction(
    async (tx) => {
      const inserted = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO "StripeWebhookEvent" ("id", "type", "livemode", "stripeCreated", "status", "createdAt")
        VALUES (${event.id}, ${event.type}, ${Boolean(event.livemode)}, ${stripeCreated}, 'processing', NOW())
        ON CONFLICT ("id") DO NOTHING
        RETURNING "id"
      `;

      if (inserted.length === 0) {
        const existing = await tx.stripeWebhookEvent.findUnique({
          where: { id: event.id },
          select: { status: true },
        });
        if (existing?.status === 'processed') {
          return { duplicate: true, stale: false };
        }
        throw new StripeWebhookProcessingError('webhook event is not in a terminal state');
      }

      const applied = await applyEvent(tx, { ...event, created: stripeCreated }, options?.subscription);
      await tx.stripeWebhookEvent.update({
        where: { id: event.id },
        data: { status: 'processed', processedAt: new Date() },
      });
      return { duplicate: false, stale: applied.stale };
    },
    { timeout: 20000, maxWait: 20000 }
  );
}
