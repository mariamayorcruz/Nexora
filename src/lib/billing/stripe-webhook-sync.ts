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

/** Same event.created. The event payload is not ordered, and event.id is not chronological. */
export class StripeWebhookTieError extends StripeWebhookProcessingError {
  readonly resource: 'subscription' | 'invoice';
  readonly resourceId: string;

  constructor(resource: 'subscription' | 'invoice', resourceId: string) {
    super(`same-second ${resource} event ${resourceId} has no canonical resolution`);
    this.name = 'StripeWebhookTieError';
    this.resource = resource;
    this.resourceId = resourceId;
  }
}

export type StripeWebhookProcessResult = {
  duplicate: boolean;
  stale: boolean;
  tie: boolean;
};

export type StripeWebhookProcessOptions = {
  subscription?: Stripe.Subscription;
  canonicalSubscription?: Stripe.Subscription;
  canonicalInvoice?: Stripe.Invoice;
  /** The caller already loaded canonical Stripe state for an equal event.created. */
  tieResolution?: boolean;
  db?: Db;
  /**
   * Runs after the aggregate lock and the version or owner read, before the
   * upsert. Tests use it as a concurrency barrier. It must not call Stripe.
   */
  afterAggregateLock?: () => Promise<void> | void;
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

type VersionDecision = 'apply' | 'stale' | 'tie';

function decideVersion(stored: number | null | undefined, incoming: number): VersionDecision {
  if (stored == null || incoming > stored) return 'apply';
  if (incoming < stored) return 'stale';
  return 'tie';
}

function customerLockKey(customerId: string): string {
  return `stripe-customer:${customerId}`;
}

function userLockKey(userId: string): string {
  return `stripe-user:${userId}`;
}

async function lockAggregate(tx: Prisma.TransactionClient, keys: string[]): Promise<void> {
  const sorted = [...new Set(keys)].sort();
  for (const key of sorted) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text AS "locked"`;
  }
}

async function waitAtBarrier(options: StripeWebhookProcessOptions | undefined) {
  if (options?.afterAggregateLock) await options.afterAggregateLock();
}

const ACTIVE_REGRESSION = new Set(['trialing', 'incomplete', 'incomplete_expired']);

function subscriptionRegresses(stored: string | null | undefined, incoming: string): boolean {
  if (!stored) return false;
  if (stored === 'canceled' && incoming !== 'canceled') return true;
  if (stored === 'active' && ACTIVE_REGRESSION.has(incoming)) return true;
  return false;
}

function invoiceRegresses(stored: string | null | undefined, incoming: string): boolean {
  return stored === 'paid' && incoming !== 'paid';
}

const UNRESOLVED: { stale: false; tie: false } = { stale: false, tie: false };

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

type InvoiceWriteResult = { stale: boolean; tie: boolean };

function invoiceData(projection: InvoiceProjection) {
  return {
    amount: compatibilityMajorAmount(projection.amountMinor, projection.currency),
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
}

function resolveTiedInvoice(
  storedStatus: string | null | undefined,
  projection: InvoiceProjection,
  options: StripeWebhookProcessOptions | undefined
): InvoiceProjection | null {
  if (!options?.tieResolution) {
    throw new StripeWebhookTieError('invoice', projection.stripeInvoiceId);
  }
  const canonical = options.canonicalInvoice;
  if (!canonical || canonical.id !== projection.stripeInvoiceId) {
    throw new StripeWebhookProcessingError('canonical invoice is required to resolve a same-second tie');
  }
  const resolved = readInvoice(canonical, projection.sourceEventCreated);
  if (invoiceRegresses(storedStatus, resolved.status)) return null;
  return resolved;
}

async function writeInvoiceIfNewer(
  tx: Prisma.TransactionClient,
  userId: string,
  projection: InvoiceProjection,
  options: StripeWebhookProcessOptions | undefined,
  onTie: 'throw' | 'keep'
): Promise<InvoiceWriteResult> {
  const existing = await tx.invoice.findUnique({
    where: { stripeInvoiceId: projection.stripeInvoiceId },
    select: { sourceEventCreated: true, status: true },
  });
  const decision = decideVersion(existing?.sourceEventCreated, projection.sourceEventCreated);
  if (decision === 'stale') return { stale: true, tie: false };
  let next = projection;
  if (decision === 'tie') {
    if (onTie === 'keep') return { stale: false, tie: true };
    const resolved = resolveTiedInvoice(existing?.status, projection, options);
    if (!resolved) return { stale: false, tie: true };
    next = resolved;
  }

  const data = invoiceData(next);
  await tx.invoice.upsert({
    where: { stripeInvoiceId: next.stripeInvoiceId },
    update: data,
    create: {
      userId,
      stripeInvoiceId: next.stripeInvoiceId,
      ...data,
    },
  });
  return { stale: false, tie: decision === 'tie' };
}

async function savePending(
  tx: Prisma.TransactionClient,
  projection: InvoiceProjection,
  options: StripeWebhookProcessOptions | undefined
): Promise<InvoiceWriteResult> {
  const existing = await tx.pendingStripeInvoice.findUnique({
    where: { stripeInvoiceId: projection.stripeInvoiceId },
    select: { sourceEventCreated: true, status: true },
  });
  const decision = decideVersion(existing?.sourceEventCreated, projection.sourceEventCreated);
  if (decision === 'stale') return { stale: true, tie: false };
  let next = projection;
  if (decision === 'tie') {
    const resolved = resolveTiedInvoice(existing?.status, projection, options);
    if (!resolved) return { stale: false, tie: true };
    next = resolved;
  }
  await tx.pendingStripeInvoice.upsert({
    where: { stripeInvoiceId: next.stripeInvoiceId },
    update: {
      stripeCustomerId: next.stripeCustomerId,
      amountMinor: next.amountMinor,
      currency: next.currency,
      status: next.status,
      description: next.description,
      periodStart: next.periodStart,
      periodEnd: next.periodEnd,
      dueDate: next.dueDate,
      paidAt: next.paidAt,
      hostedInvoiceUrl: next.hostedInvoiceUrl,
      invoicePdfUrl: next.invoicePdfUrl,
      sourceEventCreated: next.sourceEventCreated,
    },
    create: next,
  });
  return { stale: false, tie: decision === 'tie' };
}

async function promotePending(tx: Prisma.TransactionClient, userId: string, stripeCustomerId: string) {
  const pending = await tx.pendingStripeInvoice.findMany({ where: { stripeCustomerId } });
  for (const row of pending) {
    await writeInvoiceIfNewer(
      tx,
      userId,
      {
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
      },
      undefined,
      'keep'
    );
    await tx.pendingStripeInvoice.delete({ where: { stripeInvoiceId: row.stripeInvoiceId } });
  }
}

async function applySubscription(
  tx: Prisma.TransactionClient,
  subscription: Stripe.Subscription,
  sourceEventCreated: number,
  options: StripeWebhookProcessOptions | undefined
): Promise<{ stale: boolean; tie: boolean }> {
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

  await lockAggregate(tx, [customerLockKey(stripeCustomerId), userLockKey(userId)]);
  const existing = await tx.subscription.findUnique({
    where: { userId },
    select: { sourceEventCreated: true, stripeStatus: true },
  });
  await waitAtBarrier(options);
  const decision = decideVersion(existing?.sourceEventCreated, sourceEventCreated);
  let next: Stripe.Subscription | null = decision === 'apply' ? subscription : null;
  if (decision === 'tie') {
    if (!options?.tieResolution) {
      throw new StripeWebhookTieError('subscription', subscription.id);
    }
    const canonical = options.canonicalSubscription;
    if (!canonical || canonical.id !== subscription.id) {
      throw new StripeWebhookProcessingError('canonical subscription is required to resolve a same-second tie');
    }
    const canonicalUserId = canonical.metadata?.userId;
    if (canonicalUserId && canonicalUserId !== userId) {
      throw new StripeWebhookProcessingError('canonical subscription user does not match the event');
    }
    next = subscriptionRegresses(existing?.stripeStatus, canonical.status) ? null : canonical;
  }

  if (next) {
    const projected = projectSubscriptionPrice(next);
    const data = {
      plan: projected.ok ? projected.plan : 'unrecognized',
      status: next.status,
      stripeStatus: next.status,
      currentPeriodStart: unixDate(next.current_period_start, 'subscription current_period_start'),
      currentPeriodEnd: unixDate(next.current_period_end, 'subscription current_period_end'),
      cancelAtPeriodEnd: Boolean(next.cancel_at_period_end),
      stripeCustomerId,
      stripeSubId: next.id,
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
    await syncPaidLeadCapturesForAdmin(next, tx);
    await onPayingSubscriptionSynced({
      userId,
      stripeSubscriptionStatus: next.status,
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
  return { stale: decision === 'stale', tie: decision === 'tie' };
}

async function applyInvoice(
  tx: Prisma.TransactionClient,
  invoice: Stripe.Invoice,
  sourceEventCreated: number,
  options: StripeWebhookProcessOptions | undefined
): Promise<{ stale: boolean; tie: boolean }> {
  const projection = readInvoice(invoice, sourceEventCreated);
  await lockAggregate(tx, [customerLockKey(projection.stripeCustomerId)]);
  const owner = await tx.subscription.findUnique({
    where: { stripeCustomerId: projection.stripeCustomerId },
    select: { userId: true },
  });
  if (owner) {
    await lockAggregate(tx, [userLockKey(owner.userId)]);
  }
  await waitAtBarrier(options);
  if (!owner) {
    return savePending(tx, projection, options);
  }
  const written = await writeInvoiceIfNewer(tx, owner.userId, projection, options, 'throw');
  await tx.pendingStripeInvoice.deleteMany({ where: { stripeInvoiceId: projection.stripeInvoiceId } });
  return written;
}

async function applyEvent(
  tx: Prisma.TransactionClient,
  event: Stripe.Event,
  options: StripeWebhookProcessOptions | undefined
): Promise<{ stale: boolean; tie: boolean }> {
  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    return applySubscription(tx, event.data.object as Stripe.Subscription, event.created, options);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const subscriptionId = stripeId(session.subscription);
    if (!subscriptionId) return UNRESOLVED;
    if (!options?.subscription) {
      throw new StripeWebhookProcessingError('checkout subscription must be retrieved before processing');
    }
    return applySubscription(tx, options.subscription, event.created, options);
  }

  if (
    event.type === 'invoice.payment_succeeded' ||
    event.type === 'invoice.payment_failed' ||
    event.type === 'invoice.finalized'
  ) {
    return applyInvoice(tx, event.data.object as Stripe.Invoice, event.created, options);
  }

  return UNRESOLVED;
}

export async function processStripeEvent(
  event: Stripe.Event,
  options?: StripeWebhookProcessOptions
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
          return { duplicate: true, stale: false, tie: false };
        }
        throw new StripeWebhookProcessingError('webhook event is not in a terminal state');
      }

      const applied = await applyEvent(tx, { ...event, created: stripeCreated }, options);
      await tx.stripeWebhookEvent.update({
        where: { id: event.id },
        data: { status: 'processed', processedAt: new Date() },
      });
      return { duplicate: false, stale: applied.stale, tie: applied.tie };
    },
    { timeout: 20000, maxWait: 20000 }
  );
}
