import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { resolvePlanFromStripePriceId } from '@/lib/billing';
import { prisma } from '@/lib/prisma';
import { getStripeClient } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

async function getWebhookSecret() {
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    return process.env.STRIPE_WEBHOOK_SECRET;
  }

  const settings = await prisma.paymentSettings.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  return settings?.stripeWebhookSecret || null;
}

function toDate(timestamp?: number | null) {
  if (!timestamp) return new Date();
  return new Date(timestamp * 1000);
}

function getPlanFromSubscription(subscription: Stripe.Subscription) {
  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price?.id || null;
  return resolvePlanFromStripePriceId(priceId) || 'starter';
}

async function syncSubscriptionRecord(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;
  const stripeCustomerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const plan = getPlanFromSubscription(subscription);

  if (!userId) {
    return;
  }

  await prisma.subscription.upsert({
    where: { userId },
    update: {
      plan,
      status: subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : subscription.status,
      currentPeriodStart: toDate(subscription.current_period_start),
      currentPeriodEnd: toDate(subscription.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      stripeCustomerId,
      stripeSubId: subscription.id,
    },
    create: {
      userId,
      plan,
      status: subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : subscription.status,
      currentPeriodStart: toDate(subscription.current_period_start),
      currentPeriodEnd: toDate(subscription.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      stripeCustomerId,
      stripeSubId: subscription.id,
    },
  });
}

async function syncInvoiceRecord(invoice: Stripe.Invoice) {
  const stripeCustomerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || null;

  if (!stripeCustomerId) {
    return;
  }

  const subscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId },
  });

  if (!subscription) {
    return;
  }

  await prisma.invoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    update: {
      amount: invoice.amount_paid / 100,
      currency: (invoice.currency || 'usd').toUpperCase(),
      description: invoice.description || invoice.lines.data[0]?.description || null,
      status: invoice.status || 'open',
      periodStart: toDate(invoice.period_start),
      periodEnd: toDate(invoice.period_end),
      dueDate: invoice.due_date ? toDate(invoice.due_date) : null,
      paidAt: invoice.status === 'paid' && invoice.status_transitions.paid_at ? toDate(invoice.status_transitions.paid_at) : null,
    },
    create: {
      userId: subscription.userId,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_paid / 100,
      currency: (invoice.currency || 'usd').toUpperCase(),
      description: invoice.description || invoice.lines.data[0]?.description || null,
      status: invoice.status || 'open',
      periodStart: toDate(invoice.period_start),
      periodEnd: toDate(invoice.period_end),
      dueDate: invoice.due_date ? toDate(invoice.due_date) : null,
      paidAt: invoice.status === 'paid' && invoice.status_transitions.paid_at ? toDate(invoice.status_transitions.paid_at) : null,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = await getWebhookSecret();
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Stripe webhook secret is not configured.' }, { status: 500 });
    }

    const stripe = getStripeClient();
    const body = await request.text();
    const signature = headers().get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          await syncSubscriptionRecord(subscription);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscriptionRecord(subscription);
        break;
      }

      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
      case 'invoice.finalized': {
        const invoice = event.data.object as Stripe.Invoice;
        await syncInvoiceRecord(invoice);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 400 });
  }
}
