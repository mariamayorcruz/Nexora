import { asMinor, currencyExponent, minorToString, monthlyRecurringMinor } from '@/lib/billing/money';

export type MoneyLine = {
  currency: string;
  amountMinor: string;
  exponent: number | null;
  count: number;
};

export type MrrExclusionCounts = {
  legacyUnverified: number;
  trialing: number;
  nonActive: number;
  incompletePrice: number;
  unsupportedInterval: number;
};

export type SubscriptionProjectionInput = {
  userId: string;
  plan?: string | null;
  status?: string | null;
  stripeStatus: string | null;
  billingInterval: string | null;
  billingIntervalCount: number | null;
  recurringAmountMinor: bigint | number | null;
  currency: string | null;
};

export type InvoiceProjectionInput = {
  userId: string;
  status: string | null;
  amountMinor: bigint | number | null;
  currency: string | null;
  createdAt: Date;
  /** Null means the paid month is unknown. createdAt is not a substitute. */
  paidAt?: Date | null;
};

export type RevenueSnapshot = {
  mrrByCurrency: MoneyLine[];
  arrByCurrency: MoneyLine[];
  collectedByCurrency: MoneyLine[];
  monthlyCollectedByCurrency: MoneyLine[];
  activeSubscriptionCount: number;
  trialingSubscriptionCount: number;
  excludedFromMrr: MrrExclusionCounts;
  pendingInvoiceCount: number;
  legacyInvoiceCount: number;
  monthlyLegacyInvoiceCount: number;
  /** Paid invoices whose paidAt is null. They are not placed in a month. */
  monthlyPaidAtUnknownCount: number;
  churnRate: null;
  trialToPaid: null;
};

export type UserCollected =
  | { status: 'none' }
  | { status: 'unverified' }
  | { status: 'verified'; currency: string; exponent: number | null; amountMinor: bigint };

export type CollectedScope = {
  status: 'ok' | 'mixed_currency' | 'legacy_unverified' | 'empty';
  currency: string | null;
  exponent: number | null;
  totalMinor: bigint;
  byUserId: Map<string, bigint>;
};

type Bucket = { amount: bigint; count: number };

function addBucket(map: Map<string, Bucket>, currency: string, amount: bigint) {
  const key = currency.trim().toUpperCase();
  const current = map.get(key) ?? { amount: 0n, count: 0 };
  current.amount += amount;
  current.count += 1;
  map.set(key, current);
}

function linesFrom(map: Map<string, Bucket>): MoneyLine[] {
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([currency, bucket]) => ({
      currency,
      amountMinor: minorToString(bucket.amount),
      exponent: currencyExponent(currency),
      count: bucket.count,
    }));
}

export function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function startOfNextUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

function paidInUtcMonth(paidAt: Date | null | undefined, monthStart: Date, monthEnd: Date): boolean {
  return paidAt != null && paidAt >= monthStart && paidAt < monthEnd;
}

export type MrrClass =
  | 'included'
  | 'legacy_unverified'
  | 'trialing'
  | 'non_active'
  | 'incomplete_price'
  | 'unsupported_interval';

export function classifySubscription(row: SubscriptionProjectionInput): MrrClass {
  if (!row.stripeStatus) return 'legacy_unverified';
  if (row.stripeStatus === 'trialing') return 'trialing';
  if (row.stripeStatus !== 'active') return 'non_active';
  const amount = asMinor(row.recurringAmountMinor);
  const interval = row.billingInterval;
  const intervalCount = row.billingIntervalCount;
  const currency = row.currency?.trim().toUpperCase() || '';
  if (amount == null || !interval || intervalCount == null || intervalCount < 1 || !/^[A-Z]{3}$/.test(currency)) {
    return 'incomplete_price';
  }
  if (interval !== 'month' && interval !== 'year') return 'unsupported_interval';
  return 'included';
}

export function subscriptionMonthlyMinor(row: SubscriptionProjectionInput): { currency: string; amountMinor: bigint } | null {
  if (classifySubscription(row) !== 'included') return null;
  const amount = asMinor(row.recurringAmountMinor);
  if (amount == null || !row.billingInterval || row.billingIntervalCount == null || !row.currency) return null;
  const monthly = monthlyRecurringMinor({
    amountMinor: amount,
    interval: row.billingInterval,
    intervalCount: row.billingIntervalCount,
  });
  if (monthly == null) return null;
  return { currency: row.currency.trim().toUpperCase(), amountMinor: monthly };
}

export function summarizePlatformRevenue(input: {
  subscriptions: SubscriptionProjectionInput[];
  invoices: InvoiceProjectionInput[];
  pendingInvoiceCount?: number;
  now?: Date;
}): RevenueSnapshot {
  const exclusions: MrrExclusionCounts = {
    legacyUnverified: 0,
    trialing: 0,
    nonActive: 0,
    incompletePrice: 0,
    unsupportedInterval: 0,
  };
  const mrr = new Map<string, Bucket>();
  let activeSubscriptionCount = 0;
  let trialingSubscriptionCount = 0;

  for (const row of input.subscriptions) {
    if (row.stripeStatus === 'active') activeSubscriptionCount += 1;
    if (row.stripeStatus === 'trialing') trialingSubscriptionCount += 1;
    const kind = classifySubscription(row);
    if (kind === 'legacy_unverified') exclusions.legacyUnverified += 1;
    else if (kind === 'trialing') exclusions.trialing += 1;
    else if (kind === 'non_active') exclusions.nonActive += 1;
    else if (kind === 'incomplete_price') exclusions.incompletePrice += 1;
    else if (kind === 'unsupported_interval') exclusions.unsupportedInterval += 1;
    else {
      const monthly = subscriptionMonthlyMinor(row);
      if (!monthly) {
        exclusions.incompletePrice += 1;
        continue;
      }
      addBucket(mrr, monthly.currency, monthly.amountMinor);
    }
  }

  const now = input.now ?? new Date();
  const monthStart = startOfUtcMonth(now);
  const monthEnd = startOfNextUtcMonth(now);
  const collected = new Map<string, Bucket>();
  const monthlyCollected = new Map<string, Bucket>();
  let legacyInvoiceCount = 0;
  let monthlyLegacyInvoiceCount = 0;
  let monthlyPaidAtUnknownCount = 0;

  for (const invoice of input.invoices) {
    if (invoice.status !== 'paid') continue;
    const paidAt = invoice.paidAt ?? null;
    if (paidAt == null) monthlyPaidAtUnknownCount += 1;
    const inMonth = paidInUtcMonth(paidAt, monthStart, monthEnd);
    const amount = asMinor(invoice.amountMinor);
    if (amount == null || !invoice.currency || !/^[A-Z]{3}$/.test(invoice.currency.trim().toUpperCase())) {
      legacyInvoiceCount += 1;
      if (inMonth) monthlyLegacyInvoiceCount += 1;
      continue;
    }
    const currency = invoice.currency.trim().toUpperCase();
    addBucket(collected, currency, amount);
    if (inMonth) addBucket(monthlyCollected, currency, amount);
  }

  const mrrByCurrency = linesFrom(mrr);
  const arrByCurrency = mrrByCurrency.map((line) => ({
    ...line,
    amountMinor: minorToString(asMinor(line.amountMinor)! * 12n),
  }));

  return {
    mrrByCurrency,
    arrByCurrency,
    collectedByCurrency: linesFrom(collected),
    monthlyCollectedByCurrency: linesFrom(monthlyCollected),
    activeSubscriptionCount,
    trialingSubscriptionCount,
    excludedFromMrr: exclusions,
    pendingInvoiceCount: input.pendingInvoiceCount ?? 0,
    legacyInvoiceCount,
    monthlyLegacyInvoiceCount,
    monthlyPaidAtUnknownCount,
    churnRate: null,
    trialToPaid: null,
  };
}

export type MonthlyCollectedLine = {
  month: string;
  currency: string;
  amountMinor: string;
};

/**
 * Paid invoices grouped by the UTC month of paidAt.
 * A null paidAt is omitted. createdAt is not used.
 * A paidAt after `now` stays in its own future month when it is inside the
 * trailing window; it is not folded into the current month.
 */
export function collectedRevenueByMonth(
  invoices: InvoiceProjectionInput[],
  now = new Date()
): MonthlyCollectedLine[] {
  const windowStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() - 12,
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds()
    )
  );
  const monthly = new Map<string, Map<string, bigint>>();
  for (const invoice of invoices) {
    if (invoice.status !== 'paid' || invoice.paidAt == null || invoice.paidAt < windowStart) continue;
    const amount = asMinor(invoice.amountMinor);
    const currency = invoice.currency?.trim().toUpperCase() || '';
    if (amount == null || !/^[A-Z]{3}$/.test(currency)) continue;
    const month = invoice.paidAt.toISOString().slice(0, 7);
    const byCurrency = monthly.get(month) ?? new Map<string, bigint>();
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0n) + amount);
    monthly.set(month, byCurrency);
  }
  return [...monthly.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .flatMap(([month, byCurrency]) =>
      [...byCurrency.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([currency, amountMinor]) => ({
          month,
          currency,
          amountMinor: minorToString(amountMinor),
        }))
    );
}

export function collectedForUser(invoices: InvoiceProjectionInput[]): UserCollected {
  const paid = invoices.filter((invoice) => invoice.status === 'paid');
  if (paid.length === 0) return { status: 'none' };
  let currency: string | null = null;
  let total = 0n;
  for (const invoice of paid) {
    const amount = asMinor(invoice.amountMinor);
    const code = invoice.currency?.trim().toUpperCase() || '';
    if (amount == null || !/^[A-Z]{3}$/.test(code)) return { status: 'unverified' };
    if (currency && currency !== code) return { status: 'unverified' };
    currency = code;
    total += amount;
  }
  if (!currency) return { status: 'unverified' };
  return { status: 'verified', currency, exponent: currencyExponent(currency), amountMinor: total };
}

/**
 * Plan and source totals are exact only when every paid invoice shares one
 * currency and has amountMinor. Mixed currencies and legacy floats are not summed.
 */
export function collectedScope(invoices: InvoiceProjectionInput[]): CollectedScope {
  const paid = invoices.filter((invoice) => invoice.status === 'paid');
  if (paid.length === 0) {
    return { status: 'empty', currency: null, exponent: null, totalMinor: 0n, byUserId: new Map() };
  }
  let currency: string | null = null;
  const byUserId = new Map<string, bigint>();
  let total = 0n;
  for (const invoice of paid) {
    const amount = asMinor(invoice.amountMinor);
    const code = invoice.currency?.trim().toUpperCase() || '';
    if (amount == null || !/^[A-Z]{3}$/.test(code)) {
      return { status: 'legacy_unverified', currency: null, exponent: null, totalMinor: 0n, byUserId: new Map() };
    }
    if (currency && currency !== code) {
      return { status: 'mixed_currency', currency: null, exponent: null, totalMinor: 0n, byUserId: new Map() };
    }
    currency = code;
    total += amount;
    byUserId.set(invoice.userId, (byUserId.get(invoice.userId) ?? 0n) + amount);
  }
  return {
    status: 'ok',
    currency,
    exponent: currency ? currencyExponent(currency) : null,
    totalMinor: total,
    byUserId,
  };
}
