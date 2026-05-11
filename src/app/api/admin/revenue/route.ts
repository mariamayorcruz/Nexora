import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const adminCheck = await verifyAdmin(request);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const subscriptions = await prisma.subscription.findMany({
      where: { status: 'active' },
      include: { user: true },
    });

    const planPrices: Record<string, number> = {
      starter: 29,
      professional: 79,
      enterprise: 199,
      scale: 199,
      growth: 79,
    };

    const mrr = subscriptions.reduce((sum, sub) => {
      const price = planPrices[sub.plan?.toLowerCase() || ''] || 0;
      return sum + price;
    }, 0);

    return NextResponse.json({
      revenue: {
        mrr,
        arr: mrr * 12,
        totalRevenue: mrr,
        activeSubscriptions: subscriptions.length,
        churnRate: 0,
        trialToPaid: 0,
      },
    });
  } catch (error) {
    console.error('Error fetching revenue:', error);
    return NextResponse.json({ error: 'Error fetching revenue' }, { status: 500 });
  }
}
