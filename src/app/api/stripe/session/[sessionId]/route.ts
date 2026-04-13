import { NextRequest, NextResponse } from 'next/server';
import { getBillingPlanLabel } from '@/lib/billing';
import { getStripeClient } from '@/lib/stripe';
import { getBearerToken, getUserIdFromAuthorizationHeader } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!getBearerToken(authHeader)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = getUserIdFromAuthorizationHeader(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(params.sessionId, {
      expand: ['subscription'],
    });

    const ownsByClientRef = session.client_reference_id === userId;
    const ownsByMetadata = session.metadata?.userId === userId;
    if (!ownsByClientRef && !ownsByMetadata) {
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
