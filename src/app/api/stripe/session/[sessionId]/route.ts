import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getBillingPlanLabel } from '@/lib/billing';
import { getStripeClient } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key') as { userId: string };

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(params.sessionId, {
      expand: ['subscription'],
    });

    if (session.client_reference_id && session.client_reference_id !== decoded.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const plan = getBillingPlanLabel(session.metadata?.plan || null);

    return NextResponse.json({
      session: {
        id: session.id,
        status: session.status,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email || null,
        plan,
      },
    });
  } catch (error) {
    console.error('Stripe session lookup error:', error);
    return NextResponse.json(
      { error: 'No se pudo validar la sesion de pago.' },
      { status: 500 }
    );
  }
}
