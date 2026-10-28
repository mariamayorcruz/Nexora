import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { processStripeEvent, StripeWebhookTieError } from '@/lib/billing/stripe-webhook-sync';
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

function subscriptionIdFromSession(session: Stripe.Checkout.Session): string | null {
  if (!session.subscription) return null;
  return typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
}

export async function POST(request: NextRequest) {
  const webhookSecret = await getWebhookSecret();
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook secret is not configured.' }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid Stripe signature.' }, { status: 400 });
  }

  let checkoutSubscription: Stripe.Subscription | undefined;
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = subscriptionIdFromSession(session);
      if (subscriptionId) {
        checkoutSubscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
      }
    }

    const result = await processStripeEvent(event, { subscription: checkoutSubscription });
    return NextResponse.json({ received: true, duplicate: result.duplicate });
  } catch (error) {
    if (error instanceof StripeWebhookTieError) {
      try {
        const stripe = getStripeClient();
        const result =
          error.resource === 'subscription'
            ? await processStripeEvent(event, {
                subscription: checkoutSubscription,
                canonicalSubscription: await stripe.subscriptions.retrieve(error.resourceId),
                tieResolution: true,
              })
            : await processStripeEvent(event, {
                canonicalInvoice: await stripe.invoices.retrieve(error.resourceId),
                tieResolution: true,
              });
        return NextResponse.json({ received: true, duplicate: result.duplicate, tie: true });
      } catch {
        console.error('Stripe webhook tie resolution failed');
        return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
      }
    }
    console.error('Stripe webhook processing failed');
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
