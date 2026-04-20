import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.ADMIN_SECRET;
    const receivedSecret = request.headers.get('x-admin-secret');

    if (!expectedSecret) {
      return NextResponse.json(
        { error: 'ADMIN_SECRET is not configured' },
        { status: 500 }
      );
    }

    if (!receivedSecret || receivedSecret !== expectedSecret) {
      return unauthorized();
    }

    const email = 'demo@gotnexora.com';
    const password = 'Demo2026!';
    const name = 'Demo Nexora';

    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date(currentPeriodStart);
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        password: hashedPassword,
        onboardingCompletedAt: null,
        onboardingData: null,
        subscription: {
          upsert: {
            update: {
              plan: 'professional',
              status: 'active',
              currentPeriodStart,
              currentPeriodEnd,
              cancelAtPeriodEnd: false,
            },
            create: {
              plan: 'professional',
              status: 'active',
              currentPeriodStart,
              currentPeriodEnd,
              cancelAtPeriodEnd: false,
            },
          },
        },
      },
      create: {
        email,
        name,
        password: hashedPassword,
        onboardingCompletedAt: null,
        onboardingData: null,
        subscription: {
          create: {
            plan: 'professional',
            status: 'active',
            currentPeriodStart,
            currentPeriodEnd,
            cancelAtPeriodEnd: false,
          },
        },
      },
      include: {
        subscription: true,
      },
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        onboardingCompletedAt: user.onboardingCompletedAt,
        subscription: user.subscription,
      },
    });
  } catch (error) {
    console.error('[admin/create-demo-user] error:', error);
    return NextResponse.json(
      { error: 'Failed to create demo user' },
      { status: 500 }
    );
  }
}
