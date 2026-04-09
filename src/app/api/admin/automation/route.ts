import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { buildAdminAlerts, buildAutomationPlays } from '@/lib/admin-ops';
import { getAdminWorkspaceSnapshot, saveAdminWorkspacePartial } from '@/lib/admin-config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const [subscriptions, campaigns, invoices, snapshot] = await Promise.all([
      prisma.subscription.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          plan: true,
          status: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          createdAt: true,
        },
      }),
      prisma.campaign.findMany({
        orderBy: { createdAt: 'desc' },
        include: { analytics: true, adAccount: { select: { platform: true, accountName: true } } },
      }),
      prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, userId: true, amount: true, status: true, createdAt: true },
      }),
      getAdminWorkspaceSnapshot(),
    ]);

    const plays = buildAutomationPlays({ campaigns, subscriptions });
    const alerts = buildAdminAlerts({
      subscriptions,
      campaigns,
      invoices,
      paymentReady: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
      smtpReady: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    });

    return NextResponse.json({
      automation: {
        alerts,
        plays,
        config: snapshot.automation,
        queuePreview: [
          'Creative rescue when spend rises without conversion',
          'Budget scale notice for ROAS winners',
          'Retention email when cancelAtPeriodEnd switches on',
          'WhatsApp follow-up when lead requests faster contact',
        ],
      },
    });
  } catch (error) {
    console.error('Error fetching automation center:', error);
    return NextResponse.json({ error: 'Error fetching automation center' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const body = await request.json();
    await saveAdminWorkspacePartial({
      automationConfig: body.config,
    });

    const snapshot = await getAdminWorkspaceSnapshot();
    return NextResponse.json({
      automation: snapshot.automation,
    });
  } catch (error) {
    console.error('Error saving automation center:', error);
    return NextResponse.json({ error: 'Error saving automation center' }, { status: 500 });
  }
}
