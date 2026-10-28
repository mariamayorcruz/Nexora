/**
 * Point 8C revenue core on disposable Postgres only.
 *
 * Requires FR004_DATABASE_URL. DATABASE_URL is never used as a fallback, so a
 * production URL in the parent environment cannot be selected.
 * Stripe is not called. Signature checks use a local test secret.
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import {
  POINT8C_NAME,
  assertActiveMigrationSet,
  assertDisposableDatabaseUrl,
  prismaCliVersion,
  psql,
  repoRoot,
  runPrisma,
  sanitizeDbUrlForLog,
} from './fr004-lib'

const localUrl = process.env.FR004_DATABASE_URL
if (!localUrl) {
  console.error('[point8c] FR004_DATABASE_URL is required. DATABASE_URL is not a fallback.')
  process.exit(1)
}
assertDisposableDatabaseUrl(localUrl, 'FR004_DATABASE_URL')
process.env.DATABASE_URL = localUrl
process.env.STRIPE_SECRET_KEY = 'sk_test_point8c_local_only'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_point8c_local_only'
process.env.JWT_SECRET = 'point8c-local-jwt-secret'

const TEST_WEBHOOK_SECRET = 'whsec_point8c_local_only'
const PERIOD_START = 1_700_000_000
const PERIOD_END = 1_702_592_000

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function resetPublic(url: string) {
  psql(url, 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
}

type PriceInput = {
  id: string
  unit: number
  currency: string
  interval: 'day' | 'week' | 'month' | 'year'
  count?: number
  quantity?: number
}

function subscriptionFixture(input: {
  id: string
  customer: string
  userId: string
  status: string
  items: PriceInput[]
  currency?: string
}): Stripe.Subscription {
  return {
    id: input.id,
    object: 'subscription',
    customer: input.customer,
    status: input.status,
    metadata: { userId: input.userId },
    current_period_start: PERIOD_START,
    current_period_end: PERIOD_END,
    cancel_at_period_end: false,
    currency: input.currency || input.items[0]?.currency || 'usd',
    items: {
      object: 'list',
      has_more: false,
      url: '/v1/subscription_items',
      data: input.items.map((item, index) => ({
        id: `si_${input.id}_${index}`,
        object: 'subscription_item',
        quantity: item.quantity ?? 1,
        price: {
          id: item.id,
          object: 'price',
          unit_amount: item.unit,
          currency: item.currency,
          recurring: { interval: item.interval, interval_count: item.count ?? 1 },
        },
      })),
    },
    discount: { coupon: { amount_off: 100, currency: 'usd' } },
  } as unknown as Stripe.Subscription
}

function invoiceFixture(input: {
  id: string
  customer: string
  amountPaid: number
  currency: string
  status?: string
}): Stripe.Invoice {
  return {
    id: input.id,
    object: 'invoice',
    customer: input.customer,
    amount_paid: input.amountPaid,
    currency: input.currency,
    status: input.status || 'paid',
    period_start: PERIOD_START,
    period_end: PERIOD_END,
    status_transitions: { paid_at: PERIOD_START + 10 },
    lines: { data: [{ description: input.id }] },
    description: input.id,
  } as unknown as Stripe.Invoice
}

function stripeEvent(input: {
  id: string
  created: number
  type: string
  object: unknown
}): Stripe.Event {
  return {
    id: input.id,
    object: 'event',
    api_version: '2023-10-16',
    created: input.created,
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type: input.type,
    data: { object: input.object },
  } as Stripe.Event
}

async function expectThrow(fn: () => Promise<unknown>, label: string) {
  let threw = false
  try {
    await fn()
  } catch {
    threw = true
  }
  assert(threw, `${label} must fail`)
}

async function main() {
  const url = localUrl as string
  console.log(`[point8c] prisma=${prismaCliVersion()}`)
  console.log(`[point8c] target=${sanitizeDbUrlForLog(url)}`)
  assertActiveMigrationSet()

  const migrationSql = fs.readFileSync(
    path.join(repoRoot(), 'prisma', 'migrations', POINT8C_NAME, 'migration.sql'),
    'utf8'
  )
  const executableSql = migrationSql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
  assert(!/organizationId/i.test(executableSql), '8C migration must not add organizationId')
  assert(!/CrmLead/i.test(executableSql), '8C migration must not touch CrmLead')
  assert(!/\bDROP\b/i.test(executableSql), '8C migration must be additive')
  assert(executableSql.includes('StripeWebhookEvent'), '8C migration creates the event table')
  assert(executableSql.includes('PendingStripeInvoice'), '8C migration creates the pending invoice table')

  const { currencyExponent, divRoundHalfUp } = await import('../src/lib/billing/money')
  assert(currencyExponent('jpy') === 0, 'JPY exponent 0')
  assert(currencyExponent('USD') === 2, 'USD exponent 2')
  assert(currencyExponent('ugx') === 2, 'UGX stays exponent 2 in the Stripe API')
  assert(currencyExponent('isk') === 2, 'ISK exponent 2')
  assert(currencyExponent('huf') === 2, 'HUF charge exponent 2')
  assert(currencyExponent('twd') === 2, 'TWD charge exponent 2')
  assert(currencyExponent('BHD') === 2, 'do not invent exponent 3')
  assert(currencyExponent('us') === null, 'short code has no exponent')
  assert(currencyExponent('USDX') === null, 'long code has no exponent')
  assert(divRoundHalfUp(101n, 2n) === 51n, 'half-up 101/2 = 51')

  resetPublic(url)
  const deploy = runPrisma(['migrate', 'deploy'], { ...process.env, DATABASE_URL: url })
  assert(deploy.includes(POINT8C_NAME), 'local migrate deploy applied Point 8C')
  const orgOnSubscription = psql(
    url,
    `SELECT COUNT(*)::text FROM information_schema.columns
     WHERE table_schema='public' AND table_name='Subscription' AND column_name='organizationId';`
  )
  assert(orgOnSubscription === '0', 'Subscription must not gain organizationId')

  const { prisma } = await import('../src/lib/prisma')
  const { processStripeEvent, projectSubscriptionPrice } = await import('../src/lib/billing/stripe-webhook-sync')
  const { summarizePlatformRevenue } = await import('../src/lib/billing/revenue-metrics')
  const { POST } = await import('../src/app/api/stripe/webhook/route')
  const { GET: getAdminRevenue } = await import('../src/app/api/admin/revenue/route')
  const { GET: getBillingInvoices } = await import('../src/app/api/billing/invoices/route')
  const { signUserToken } = await import('../src/lib/jwt')

  async function createUser(id: string, email: string) {
    await prisma.user.create({ data: { id, email, password: 'x' } })
  }

  async function sendSub(input: {
    eventId: string
    created: number
    userId: string
    customer: string
    subId: string
    status: string
    items: PriceInput[]
  }) {
    const subscription = subscriptionFixture({
      id: input.subId,
      customer: input.customer,
      userId: input.userId,
      status: input.status,
      items: input.items,
    })
    return processStripeEvent(
      stripeEvent({
        id: input.eventId,
        created: input.created,
        type: 'customer.subscription.updated',
        object: subscription,
      })
    )
  }

  await createUser('user_month', 'month@example.com')
  await sendSub({
    eventId: 'evt_month',
    created: 200,
    userId: 'user_month',
    customer: 'cus_month',
    subId: 'sub_month',
    status: 'active',
    items: [{ id: 'price_month', unit: 2900, currency: 'usd', interval: 'month' }],
  })
  const month = await prisma.subscription.findUniqueOrThrow({ where: { userId: 'user_month' } })
  const monthSummary = summarizePlatformRevenue({ subscriptions: [month], invoices: [] })
  assert(monthSummary.mrrByCurrency.length === 1, 'monthly MRR line')
  assert(monthSummary.mrrByCurrency[0].amountMinor === '2900', 'monthly amount stays 2900 minor units')
  assert(monthSummary.mrrByCurrency[0].exponent === 2, 'USD exponent 2')
  assert(month.plan !== 'starter' || month.stripePriceId === 'price_month', 'catalog id may map, unknown must not default later')

  await createUser('user_year', 'year@example.com')
  await sendSub({
    eventId: 'evt_year',
    created: 200,
    userId: 'user_year',
    customer: 'cus_year',
    subId: 'sub_year',
    status: 'active',
    items: [{ id: 'price_year', unit: 12000, currency: 'usd', interval: 'year' }],
  })
  const year = await prisma.subscription.findUniqueOrThrow({ where: { userId: 'user_year' } })
  assert(summarizePlatformRevenue({ subscriptions: [year], invoices: [] }).mrrByCurrency[0].amountMinor === '1000', 'annual / 12')

  await createUser('user_count', 'count@example.com')
  await sendSub({
    eventId: 'evt_count',
    created: 200,
    userId: 'user_count',
    customer: 'cus_count',
    subId: 'sub_count',
    status: 'active',
    items: [{ id: 'price_count', unit: 3000, currency: 'usd', interval: 'month', count: 3 }],
  })
  const counted = await prisma.subscription.findUniqueOrThrow({ where: { userId: 'user_count' } })
  assert(
    summarizePlatformRevenue({ subscriptions: [counted], invoices: [] }).mrrByCurrency[0].amountMinor === '1000',
    'month interval_count 3 divides by 3'
  )

  await createUser('user_year_count', 'year-count@example.com')
  await sendSub({
    eventId: 'evt_year_count',
    created: 200,
    userId: 'user_year_count',
    customer: 'cus_year_count',
    subId: 'sub_year_count',
    status: 'active',
    items: [{ id: 'price_year_count', unit: 24000, currency: 'usd', interval: 'year', count: 2 }],
  })
  const yearCount = await prisma.subscription.findUniqueOrThrow({ where: { userId: 'user_year_count' } })
  assert(
    summarizePlatformRevenue({ subscriptions: [yearCount], invoices: [] }).mrrByCurrency[0].amountMinor === '1000',
    'year interval_count 2 divides by 24'
  )

  await createUser('user_half', 'half@example.com')
  await sendSub({
    eventId: 'evt_half',
    created: 200,
    userId: 'user_half',
    customer: 'cus_half',
    subId: 'sub_half',
    status: 'active',
    items: [{ id: 'price_half', unit: 101, currency: 'usd', interval: 'month', count: 2 }],
  })
  const half = await prisma.subscription.findUniqueOrThrow({ where: { userId: 'user_half' } })
  assert(summarizePlatformRevenue({ subscriptions: [half], invoices: [] }).mrrByCurrency[0].amountMinor === '51', 'half-up')

  await createUser('user_jpy', 'jpy@example.com')
  await sendSub({
    eventId: 'evt_jpy',
    created: 200,
    userId: 'user_jpy',
    customer: 'cus_jpy',
    subId: 'sub_jpy',
    status: 'active',
    items: [{ id: 'price_jpy', unit: 500, currency: 'jpy', interval: 'month' }],
  })
  const jpy = await prisma.subscription.findUniqueOrThrow({ where: { userId: 'user_jpy' } })
  const jpySummary = summarizePlatformRevenue({ subscriptions: [jpy], invoices: [] })
  assert(jpySummary.mrrByCurrency[0].amountMinor === '500', 'JPY is not divided by 100')
  assert(jpySummary.mrrByCurrency[0].currency === 'JPY', 'currency stored uppercase')
  assert(jpySummary.mrrByCurrency[0].exponent === 0, 'JPY exponent 0')

  const mixed = summarizePlatformRevenue({ subscriptions: [month, jpy], invoices: [] })
  assert(mixed.mrrByCurrency.length === 2, 'distinct currencies stay on separate lines')
  assert(
    mixed.mrrByCurrency.reduce((sum, line) => sum + Number(line.amountMinor), 0) !== 2900 + 5,
    'JPY must not be converted to a major unit before any cross-check'
  )

  await createUser('user_trial', 'trial@example.com')
  await sendSub({
    eventId: 'evt_trial',
    created: 200,
    userId: 'user_trial',
    customer: 'cus_trial',
    subId: 'sub_trial',
    status: 'trialing',
    items: [{ id: 'price_trial', unit: 2900, currency: 'usd', interval: 'month' }],
  })
  const trial = await prisma.subscription.findUniqueOrThrow({ where: { userId: 'user_trial' } })
  const trialSummary = summarizePlatformRevenue({ subscriptions: [trial], invoices: [] })
  assert(trial.stripeStatus === 'trialing', 'trialing is stored raw')
  assert(trial.status === 'trialing', 'trialing is not collapsed to active')
  assert(trialSummary.mrrByCurrency.length === 0, 'trial excluded from MRR')
  assert(trialSummary.excludedFromMrr.trialing === 1, 'trial counted in the trialing bucket')

  await createUser('user_past_due', 'past-due@example.com')
  await sendSub({
    eventId: 'evt_past_due',
    created: 200,
    userId: 'user_past_due',
    customer: 'cus_past_due',
    subId: 'sub_past_due',
    status: 'past_due',
    items: [{ id: 'price_past_due', unit: 2900, currency: 'usd', interval: 'month' }],
  })
  const pastDue = await prisma.subscription.findUniqueOrThrow({ where: { userId: 'user_past_due' } })
  assert(
    summarizePlatformRevenue({ subscriptions: [pastDue], invoices: [] }).excludedFromMrr.nonActive === 1,
    'past_due excluded'
  )

  await createUser('user_week', 'week@example.com')
  await sendSub({
    eventId: 'evt_week',
    created: 200,
    userId: 'user_week',
    customer: 'cus_week',
    subId: 'sub_week',
    status: 'active',
    items: [{ id: 'price_week', unit: 700, currency: 'usd', interval: 'week' }],
  })
  const week = await prisma.subscription.findUniqueOrThrow({ where: { userId: 'user_week' } })
  assert(week.billingInterval === 'week', 'week interval is stored')
  assert(
    summarizePlatformRevenue({ subscriptions: [week], invoices: [] }).excludedFromMrr.unsupportedInterval === 1,
    'week interval excluded from MRR'
  )

  await createUser('user_unknown', 'unknown@example.com')
  await sendSub({
    eventId: 'evt_unknown',
    created: 200,
    userId: 'user_unknown',
    customer: 'cus_unknown',
    subId: 'sub_unknown',
    status: 'active',
    items: [{ id: 'price_not_in_catalog', unit: 4242, currency: 'usd', interval: 'month' }],
  })
  const unknown = await prisma.subscription.findUniqueOrThrow({ where: { userId: 'user_unknown' } })
  assert(unknown.plan === 'unrecognized', 'unknown price is not starter')
  assert(unknown.recurringAmountMinor === 4242n, 'unknown price keeps Stripe unit_amount')
  assert(
    summarizePlatformRevenue({ subscriptions: [unknown], invoices: [] }).mrrByCurrency[0].amountMinor === '4242',
    'unknown price is not replaced with 29'
  )
  const projected = projectSubscriptionPrice(
    subscriptionFixture({
      id: 'sub_coupon',
      customer: 'cus_coupon',
      userId: 'user_unknown',
      status: 'active',
      items: [{ id: 'price_not_in_catalog', unit: 4242, currency: 'usd', interval: 'month' }],
    })
  )
  assert(projected.ok && projected.amountMinor === 4242n, 'coupon amount_off is not subtracted')

  await createUser('user_legacy', 'legacy@example.com')
  await prisma.subscription.create({
    data: {
      userId: 'user_legacy',
      plan: 'starter',
      status: 'active',
      currentPeriodStart: new Date(PERIOD_START * 1000),
      currentPeriodEnd: new Date(PERIOD_END * 1000),
    },
  })
  const legacy = await prisma.subscription.findUniqueOrThrow({ where: { userId: 'user_legacy' } })
  const legacySummary = summarizePlatformRevenue({ subscriptions: [legacy], invoices: [] })
  assert(legacy.stripeStatus == null, 'legacy row has no Stripe projection')
  assert(legacySummary.mrrByCurrency.length === 0, 'legacy row is not priced as 29')
  assert(legacySummary.excludedFromMrr.legacyUnverified === 1, 'legacy row is counted')

  await createUser('user_dup', 'dup@example.com')
  const first = await sendSub({
    eventId: 'evt_dup',
    created: 200,
    userId: 'user_dup',
    customer: 'cus_dup',
    subId: 'sub_dup',
    status: 'active',
    items: [{ id: 'price_dup', unit: 1500, currency: 'usd', interval: 'month' }],
  })
  const second = await sendSub({
    eventId: 'evt_dup',
    created: 200,
    userId: 'user_dup',
    customer: 'cus_dup',
    subId: 'sub_dup',
    status: 'active',
    items: [{ id: 'price_dup', unit: 9999, currency: 'usd', interval: 'month' }],
  })
  assert(first.duplicate === false && second.duplicate === true, 'same event.id is a duplicate')
  const dup = await prisma.subscription.findUniqueOrThrow({ where: { userId: 'user_dup' } })
  assert(dup.recurringAmountMinor === 1500n, 'duplicate event does not apply again')
  assert((await prisma.stripeWebhookEvent.count({ where: { id: 'evt_dup' } })) === 1, 'one event row')

  await createUser('user_concurrent', 'concurrent@example.com')
  const concurrentSubscription = subscriptionFixture({
    id: 'sub_concurrent',
    customer: 'cus_concurrent',
    userId: 'user_concurrent',
    status: 'active',
    items: [{ id: 'price_concurrent', unit: 1600, currency: 'usd', interval: 'month' }],
  })
  const concurrentEvent = stripeEvent({
    id: 'evt_concurrent',
    created: 300,
    type: 'customer.subscription.updated',
    object: concurrentSubscription,
  })
  const concurrent = await Promise.all([processStripeEvent(concurrentEvent), processStripeEvent(concurrentEvent)])
  assert(concurrent.filter((result) => result.duplicate).length === 1, 'one concurrent caller is the duplicate')
  assert((await prisma.subscription.count({ where: { userId: 'user_concurrent' } })) === 1, 'one subscription row')
  assert(
    (await prisma.stripeWebhookEvent.count({ where: { id: 'evt_concurrent', status: 'processed' } })) === 1,
    'one processed event'
  )

  await expectThrow(
    () =>
      sendSub({
        eventId: 'evt_missing_user',
        created: 200,
        userId: 'user_missing',
        customer: 'cus_missing',
        subId: 'sub_missing',
        status: 'active',
        items: [{ id: 'price_missing', unit: 100, currency: 'usd', interval: 'month' }],
      }),
    'missing user'
  )
  assert((await prisma.stripeWebhookEvent.count({ where: { id: 'evt_missing_user' } })) === 0, 'failed event is not processed')
  await createUser('user_missing', 'missing@example.com')
  const retried = await sendSub({
    eventId: 'evt_missing_user',
    created: 200,
    userId: 'user_missing',
    customer: 'cus_missing',
    subId: 'sub_missing',
    status: 'active',
    items: [{ id: 'price_missing', unit: 100, currency: 'usd', interval: 'month' }],
  })
  assert(retried.duplicate === false, 'retry after failure applies')
  assert((await prisma.subscription.count({ where: { userId: 'user_missing' } })) === 1, 'retry created the subscription')

  await createUser('user_early', 'early@example.com')
  const earlyInvoice = invoiceFixture({ id: 'in_early', customer: 'cus_early', amountPaid: 4242, currency: 'usd' })
  await processStripeEvent(
    stripeEvent({ id: 'evt_early_invoice', created: 100, type: 'invoice.payment_succeeded', object: earlyInvoice })
  )
  assert((await prisma.invoice.count({ where: { stripeInvoiceId: 'in_early' } })) === 0, 'early invoice is not dropped into Invoice')
  assert((await prisma.pendingStripeInvoice.count({ where: { stripeInvoiceId: 'in_early' } })) === 1, 'early invoice is pending')
  assert(
    (await prisma.stripeWebhookEvent.findUnique({ where: { id: 'evt_early_invoice' } }))?.status === 'processed',
    'pending projection is a completed effect'
  )
  await sendSub({
    eventId: 'evt_early_sub',
    created: 200,
    userId: 'user_early',
    customer: 'cus_early',
    subId: 'sub_early',
    status: 'active',
    items: [{ id: 'price_early', unit: 4242, currency: 'usd', interval: 'month' }],
  })
  const promoted = await prisma.invoice.findUniqueOrThrow({ where: { stripeInvoiceId: 'in_early' } })
  assert(promoted.userId === 'user_early', 'promoted invoice belongs to the subscription user')
  assert(promoted.amountMinor === 4242n, 'promoted amount is the minor unit')
  assert((await prisma.pendingStripeInvoice.count({ where: { stripeInvoiceId: 'in_early' } })) === 0, 'pending row is removed')

  await createUser('user_order', 'order@example.com')
  await sendSub({
    eventId: 'evt_order_new',
    created: 200,
    userId: 'user_order',
    customer: 'cus_order',
    subId: 'sub_order',
    status: 'active',
    items: [{ id: 'price_order', unit: 5000, currency: 'usd', interval: 'month' }],
  })
  const stale = await sendSub({
    eventId: 'evt_order_old',
    created: 100,
    userId: 'user_order',
    customer: 'cus_order',
    subId: 'sub_order',
    status: 'trialing',
    items: [{ id: 'price_order', unit: 1000, currency: 'usd', interval: 'month' }],
  })
  const ordered = await prisma.subscription.findUniqueOrThrow({ where: { userId: 'user_order' } })
  assert(stale.stale === true, 'older subscription event is marked stale')
  assert(ordered.stripeStatus === 'active', 'older event does not revert status')
  assert(ordered.recurringAmountMinor === 5000n, 'older event does not revert amount')
  assert((await prisma.stripeWebhookEvent.findUnique({ where: { id: 'evt_order_old' } }))?.status === 'processed', 'stale event is still processed')

  await processStripeEvent(
    stripeEvent({
      id: 'evt_invoice_new',
      created: 200,
      type: 'invoice.payment_succeeded',
      object: invoiceFixture({ id: 'in_order', customer: 'cus_order', amountPaid: 5000, currency: 'usd' }),
    })
  )
  await processStripeEvent(
    stripeEvent({
      id: 'evt_invoice_old',
      created: 100,
      type: 'invoice.payment_succeeded',
      object: invoiceFixture({ id: 'in_order', customer: 'cus_order', amountPaid: 1000, currency: 'usd' }),
    })
  )
  const orderedInvoice = await prisma.invoice.findUniqueOrThrow({ where: { stripeInvoiceId: 'in_order' } })
  assert(orderedInvoice.amountMinor === 5000n, 'older invoice event does not revert amount')

  await createUser('user_equal', 'equal@example.com')
  await sendSub({
    eventId: 'evt_equal_a',
    created: 50,
    userId: 'user_equal',
    customer: 'cus_equal',
    subId: 'sub_equal',
    status: 'active',
    items: [{ id: 'price_equal', unit: 1000, currency: 'usd', interval: 'month' }],
  })
  await sendSub({
    eventId: 'evt_equal_b',
    created: 50,
    userId: 'user_equal',
    customer: 'cus_equal',
    subId: 'sub_equal',
    status: 'active',
    items: [{ id: 'price_equal', unit: 2000, currency: 'usd', interval: 'month' }],
  })
  const equal = await prisma.subscription.findUniqueOrThrow({ where: { userId: 'user_equal' } })
  assert(equal.recurringAmountMinor === 2000n, 'equal event.created may apply')

  await prisma.stripeWebhookEvent.create({
    data: {
      id: 'evt_processing',
      type: 'customer.subscription.updated',
      livemode: false,
      stripeCreated: 10,
      status: 'processing',
    },
  })
  await expectThrow(
    () =>
      sendSub({
        eventId: 'evt_processing',
        created: 10,
        userId: 'user_equal',
        customer: 'cus_equal',
        subId: 'sub_equal',
        status: 'canceled',
        items: [{ id: 'price_equal', unit: 1, currency: 'usd', interval: 'month' }],
      }),
    'processing event'
  )
  const processing = await prisma.stripeWebhookEvent.findUniqueOrThrow({ where: { id: 'evt_processing' } })
  assert(processing.status === 'processing', 'a non-terminal event is not marked processed')
  const equalAfter = await prisma.subscription.findUniqueOrThrow({ where: { userId: 'user_equal' } })
  assert(equalAfter.stripeStatus === 'active', 'in-progress event does not change subscription state')

  const fractional = invoiceFixture({ id: 'in_fraction', customer: 'cus_equal', amountPaid: 10.5, currency: 'usd' })
  await expectThrow(
    () =>
      processStripeEvent(
        stripeEvent({ id: 'evt_fraction', created: 20, type: 'invoice.payment_succeeded', object: fractional })
      ),
    'fractional amount_paid'
  )
  assert((await prisma.stripeWebhookEvent.count({ where: { id: 'evt_fraction' } })) === 0, 'invalid amount is not processed')

  const checkout = stripeEvent({
    id: 'evt_checkout',
    created: 20,
    type: 'checkout.session.completed',
    object: { id: 'cs_test', object: 'checkout.session', subscription: 'sub_not_retrieved' },
  })
  await expectThrow(() => processStripeEvent(checkout), 'checkout without retrieved subscription')
  assert((await prisma.stripeWebhookEvent.count({ where: { id: 'evt_checkout' } })) === 0, 'checkout retrieve failure leaves no event')

  await createUser('user_route', 'route@example.com')
  const routeSubscription = subscriptionFixture({
    id: 'sub_route',
    customer: 'cus_route',
    userId: 'user_route',
    status: 'active',
    items: [{ id: 'price_route', unit: 1800, currency: 'usd', interval: 'month' }],
  })
  const routeEvent = stripeEvent({
    id: 'evt_route',
    created: 400,
    type: 'customer.subscription.updated',
    object: routeSubscription,
  })
  const payload = JSON.stringify(routeEvent)
  const stripe = new Stripe('sk_test_point8c_local_only', { apiVersion: '2023-10-16' })
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: TEST_WEBHOOK_SECRET })
  const accepted = await POST(
    new NextRequest('http://127.0.0.1/api/stripe/webhook', {
      method: 'POST',
      body: payload,
      headers: { 'stripe-signature': header },
    })
  )
  assert(accepted.status === 200, `signed webhook should be accepted, got ${accepted.status}`)
  assert((await prisma.subscription.count({ where: { userId: 'user_route' } })) === 1, 'signed webhook wrote the subscription')

  const badEvent = stripeEvent({
    id: 'evt_bad_sig',
    created: 401,
    type: 'customer.subscription.updated',
    object: routeSubscription,
  })
  const rejected = await POST(
    new NextRequest('http://127.0.0.1/api/stripe/webhook', {
      method: 'POST',
      body: JSON.stringify(badEvent),
      headers: { 'stripe-signature': 't=1,v1=deadbeef' },
    })
  )
  assert(rejected.status === 400, 'bad signature is 400')
  assert((await prisma.stripeWebhookEvent.count({ where: { id: 'evt_bad_sig' } })) === 0, 'bad signature writes no event')

  await createUser('user_admin', 'maria.cruz@gotnexora.com')
  await createUser('user_member', 'member@example.com')
  const noToken = await getAdminRevenue(new NextRequest('http://127.0.0.1/api/admin/revenue'))
  assert(noToken.status === 401, 'admin revenue without token is 401')
  const memberToken = signUserToken({ userId: 'user_member', email: 'member@example.com' })
  const member = await getAdminRevenue(
    new NextRequest('http://127.0.0.1/api/admin/revenue', {
      headers: { authorization: `Bearer ${memberToken}` },
    })
  )
  assert(member.status === 403, 'non-admin revenue is 403')
  const adminToken = signUserToken({ userId: 'user_admin', email: 'maria.cruz@gotnexora.com' })
  const admin = await getAdminRevenue(
    new NextRequest('http://127.0.0.1/api/admin/revenue', {
      headers: { authorization: `Bearer ${adminToken}` },
    })
  )
  assert(admin.status === 200, `admin revenue should be 200, got ${admin.status}`)
  const adminBody = (await admin.json()) as {
    revenue: {
      mrr?: unknown
      totalRevenue?: unknown
      mrrByCurrency: Array<{ currency: string; amountMinor: string }>
      churnRate: null
      trialToPaid: null
    }
  }
  assert(adminBody.revenue.mrr == null, 'scalar MRR is not returned')
  assert(adminBody.revenue.totalRevenue == null, 'totalRevenue is not an alias of MRR')
  assert(Array.isArray(adminBody.revenue.mrrByCurrency), 'mrrByCurrency is present')
  assert(adminBody.revenue.churnRate === null && adminBody.revenue.trialToPaid === null, 'uncalculated metrics are null')
  assert(
    !adminBody.revenue.mrrByCurrency.some((line) => line.amountMinor === '29'),
    'catalog 29 is not an MRR line'
  )

  await prisma.invoice.create({
    data: {
      userId: 'user_admin',
      stripeInvoiceId: 'in_admin_only',
      amount: 1,
      amountMinor: 100n,
      currency: 'USD',
      status: 'paid',
      description: 'only-admin',
      periodStart: new Date(PERIOD_START * 1000),
      periodEnd: new Date(PERIOD_END * 1000),
    },
  })
  await prisma.invoice.create({
    data: {
      userId: 'user_member',
      stripeInvoiceId: 'in_member_only',
      amount: 2,
      amountMinor: 200n,
      currency: 'USD',
      status: 'paid',
      description: 'only-member',
      periodStart: new Date(PERIOD_START * 1000),
      periodEnd: new Date(PERIOD_END * 1000),
    },
  })
  const own = await getBillingInvoices(
    new NextRequest('http://127.0.0.1/api/billing/invoices', {
      headers: { authorization: `Bearer ${memberToken}` },
    })
  )
  assert(own.status === 200, 'billing invoices accepts the user token')
  const ownBody = (await own.json()) as { invoices: Array<{ description: string | null; userId?: string }> }
  assert(ownBody.invoices.every((row) => row.description === 'only-member'), 'invoice list is isolated by userId')
  assert(!ownBody.invoices.some((row) => row.description === 'only-admin'), 'other user invoices are absent')

  await prisma.invoice.create({
    data: {
      userId: 'user_legacy',
      amount: 29,
      currency: 'USD',
      status: 'paid',
      description: 'legacy-float',
      periodStart: new Date(PERIOD_START * 1000),
      periodEnd: new Date(PERIOD_END * 1000),
    },
  })
  const legacyInvoiceSummary = summarizePlatformRevenue({
    subscriptions: [],
    invoices: await prisma.invoice.findMany({
      where: { description: 'legacy-float' },
      select: { userId: true, status: true, amountMinor: true, currency: true, createdAt: true },
    }),
  })
  assert(legacyInvoiceSummary.collectedByCurrency.length === 0, 'legacy float invoice is not collected revenue')
  assert(legacyInvoiceSummary.legacyInvoiceCount === 1, 'legacy float invoice is counted')

  await prisma.$disconnect()
  console.log('[point8c] PASS')
}

main().catch((error) => {
  console.error('[point8c] FAIL', error instanceof Error ? error.message : error)
  process.exit(1)
})
