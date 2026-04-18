import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { BillingCycle, BillingPlan, getBillingPlan, getStripePriceId } from '@/lib/billing';
import { prisma } from '@/lib/prisma';
import { getStripeClient } from '@/lib/stripe';
import { getBearerToken, getUserIdFromAuthorizationHeader } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!getBearerToken(authHeader)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = getUserIdFromAuthorizationHeader(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { plan, billingCycle } = (await request.json()) as {
      plan?: BillingPlan;
      billingCycle?: BillingCycle;
    };

    if (!plan || !billingCycle || !['monthly', 'yearly'].includes(billingCycle)) {
      return NextResponse.json({ error: 'Plan o ciclo invalido.' }, { status: 400 });
    }

    const planConfig = getBillingPlan(plan);
    if (!planConfig) {
      return NextResponse.json({ error: 'Plan invalido.' }, { status: 400 });
    }

    const priceId = getStripePriceId(plan, billingCycle);
    if (!priceId) {
      return NextResponse.json(
        { error: 'Stripe aun no esta configurado para este plan. Falta el price id correspondiente.' },
        { status: 500 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const stripe = getStripeClient();
    let stripeCustomerId = user.subscription?.stripeCustomerId || null;

    if (stripeCustomerId) {
      const existingCustomer = await stripe.customers.retrieve(stripeCustomerId);
      if ('deleted' in existingCustomer && existingCustomer.deleted) {
        stripeCustomerId = null;
      }
    }

    if (!stripeCustomerId) {
      const createdCustomer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: user.id },
      });

      stripeCustomerId = createdCustomer.id;

      await prisma.subscription.upsert({
        where: { userId: user.id },
        update: { stripeCustomerId },
        create: {
          userId: user.id,
          plan: user.subscription?.plan || 'starter',
          status: user.subscription?.status || 'active',
          stripeCustomerId,
          currentPeriodStart: user.subscription?.currentPeriodStart || new Date(),
          currentPeriodEnd: user.subscription?.currentPeriodEnd || new Date(),
        },
      });
    }

    const checkoutPayload: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      customer: stripeCustomerId,
      client_reference_id: user.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      success_url: `${process.env.NEXTAUTH_URL}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}&checkout=success`,
      cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/billing?checkout=cancelled`,
      metadata: {
        userId: user.id,
        plan,
        billingCycle,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          plan,
          billingCycle,
        },
      },
    };

    console.info('[stripe.checkout] creating session', {
      selectedPlan: plan,
      billingInterval: billingCycle,
      resolvedPriceId: priceId,
      mode: checkoutPayload.mode,
      success_url: checkoutPayload.success_url,
      cancel_url: checkoutPayload.cancel_url,
      customer: checkoutPayload.customer,
      customer_email: null,
      metadata: checkoutPayload.metadata,
      subscription_metadata: checkoutPayload.subscription_data?.metadata,
    });

    const session = await stripe.checkout.sessions.create(checkoutPayload);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      plan: planConfig.marketingLabel,
    });
  } catch (error) {
    const stripeError = error as {
      message?: string;
      type?: string;
      code?: string;
      param?: string;
      raw?: {
        message?: string;
        param?: string;
      };
      statusCode?: number;
    };

    console.error('Stripe checkout error:', {
      message: stripeError?.message,
      type: stripeError?.type,
      code: stripeError?.code,
      param: stripeError?.param,
      rawMessage: stripeError?.raw?.message,
      rawParam: stripeError?.raw?.param,
      statusCode: stripeError?.statusCode,
      error: stripeError,
    });
    return NextResponse.json(
      { error: 'No se pudo crear la sesion de pago en este momento.' },
      { status: 500 }
    );
  }
}
