import { NextRequest, NextResponse } from 'next/server';
import { summarizePlatformRevenue } from '@/lib/billing/revenue-metrics';
import { verifyAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const adminCheck = await verifyAdmin(request);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const [subscriptions, invoices, pendingInvoiceCount] = await Promise.all([
      prisma.subscription.findMany({
        select: {
          userId: true,
          plan: true,
          status: true,
          stripeStatus: true,
          billingInterval: true,
          billingIntervalCount: true,
          recurringAmountMinor: true,
          currency: true,
        },
      }),
      prisma.invoice.findMany({
        select: {
          userId: true,
          status: true,
          amountMinor: true,
          currency: true,
          createdAt: true,
        },
      }),
      prisma.pendingStripeInvoice.count(),
    ]);

    const revenue = summarizePlatformRevenue({
      subscriptions,
      invoices,
      pendingInvoiceCount,
    });

    return NextResponse.json({ revenue });
  } catch (error) {
    console.error('Error fetching revenue:', error);
    return NextResponse.json({ error: 'Error fetching revenue' }, { status: 500 });
  }
}
