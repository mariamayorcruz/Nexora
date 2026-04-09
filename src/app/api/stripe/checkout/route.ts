import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { BillingCycle, BillingPlan, getBillingPlan, getStripePriceId } from '@/lib/billing';
import { prisma } from '@/lib/prisma';
import { getStripeClient } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key') as { userId: string };

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
      where: { id: decoded.userId },
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

    const session = await stripe.checkout.sessions.create({
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
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      plan: planConfig.marketingLabel,
    });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'No se pudo crear la sesion de pago en este momento.' },
      { status: 500 }
    );
  }
}
