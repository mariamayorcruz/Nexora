import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

const INDUSTRIES = new Set(['ecommerce', 'servicios', 'salud', 'educacion', 'otro']);
const GOALS = new Set(['conseguir_mas_leads', 'cerrar_mas_ventas', 'automatizar_seguimiento']);
const CHANNELS = new Set(['Instagram', 'WhatsApp', 'Email', 'Facebook']);
const CUSTOMER_RANGES = new Set(['0-10', '10-50', '50-200', '200+']);

async function getUserFromToken(request: NextRequest) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const decoded = verifyUserToken(token);
  if (!decoded?.userId) {
    return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { subscription: true },
  });

  if (!user) {
    return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) };
  }

  return { user };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getUserFromToken(request);
    if ('error' in auth) return auth.error;
    const { user } = auth;

    const body = (await request.json()) as {
      businessName?: string;
      industries?: string[];
      primaryGoals?: string[];
      channels?: string[];
      customerRange?: string;
    };

    const businessName = String(body.businessName || '').trim();
    const customerRange = String(body.customerRange || '').trim();
    const rawIndustries = Array.isArray(body.industries) ? body.industries : [];
    const industries = rawIndustries
      .map((industry) => String(industry || '').trim())
      .filter((industry): industry is string => INDUSTRIES.has(industry));
    const rawPrimaryGoals = Array.isArray(body.primaryGoals) ? body.primaryGoals : [];
    const primaryGoals = rawPrimaryGoals
      .map((goal) => String(goal || '').trim())
      .filter((goal): goal is string => GOALS.has(goal));
    const rawChannels = Array.isArray(body.channels) ? body.channels : [];
    const channels = rawChannels
      .map((channel) => String(channel || '').trim())
      .filter((channel): channel is string => CHANNELS.has(channel));

    if (!businessName) {
      return NextResponse.json({ error: 'El nombre del negocio es requerido.' }, { status: 400 });
    }

    if (industries.length === 0) {
      return NextResponse.json({ error: 'Selecciona al menos un tipo de negocio válido.' }, { status: 400 });
    }

    if (primaryGoals.length === 0) {
      return NextResponse.json({ error: 'Selecciona al menos un objetivo principal válido.' }, { status: 400 });
    }

    if (!CUSTOMER_RANGES.has(customerRange)) {
      return NextResponse.json({ error: 'Selecciona un rango de clientes válido.' }, { status: 400 });
    }

    if (channels.length === 0) {
      return NextResponse.json({ error: 'Selecciona al menos un canal.' }, { status: 400 });
    }

    const subscriptionStatus = String(user.subscription?.status || '').toLowerCase();
    if (!['active', 'trialing'].includes(subscriptionStatus)) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 403 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingCompletedAt: new Date(),
        onboardingData: {
          businessName,
          industries,
          primaryGoals,
          channels,
          customerRange,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Onboarding save error:', error);
    return NextResponse.json({ error: 'No se pudo guardar el onboarding.' }, { status: 500 });
  }
}
