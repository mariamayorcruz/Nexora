import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/admin';
import {
  buildAdminAlerts,
  buildAutomationPlays,
  buildEmailCenterSummary,
  calculateHealthScore,
  calculateMrr,
} from '@/lib/admin-ops';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const [users, subscriptions, invoices, campaigns, paymentSettings] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, name: true, createdAt: true },
      }),
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
      prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, userId: true, amount: true, status: true, createdAt: true },
      }),
      prisma.campaign.findMany({
        orderBy: { createdAt: 'desc' },
        include: { analytics: true },
      }),
      prisma.paymentSettings.findFirst({
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === 'active').length;
    const totalRevenue = invoices
      .filter((invoice) => invoice.status === 'paid')
      .reduce((sum, invoice) => sum + invoice.amount, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyRevenue = invoices
      .filter((invoice) => invoice.status === 'paid' && invoice.createdAt >= startOfMonth)
      .reduce((sum, invoice) => sum + invoice.amount, 0);

    const paymentReady = Boolean(
      process.env.STRIPE_SECRET_KEY &&
        process.env.STRIPE_WEBHOOK_SECRET &&
        process.env.STRIPE_PRICE_STARTER_MONTHLY &&
        process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY &&
        process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY
    );

    const emailCenter = buildEmailCenterSummary(process.env.SUPPORT_EMAIL || '');
    const alerts = buildAdminAlerts({
      subscriptions,
      campaigns,
      invoices,
      paymentReady,
      smtpReady: emailCenter.smtpReady,
    });
    const automationPlays = buildAutomationPlays({ campaigns, subscriptions });
    const healthScore = calculateHealthScore({
      activeSubscriptions,
      totalUsers: users.length,
      alertsCount: alerts.length,
      paymentReady,
      smtpReady: emailCenter.smtpReady,
    });

    const platformDistributionMap = campaigns.reduce<Record<string, number>>((acc, campaign) => {
      const platform = campaign.adAccountId ? campaign.adAccountId : 'unknown';
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      stats: {
        totalUsers: users.length,
        activeSubscriptions,
        totalRevenue,
        monthlyRevenue,
        totalCampaigns: campaigns.length,
        activeCampaigns: campaigns.filter((campaign) => campaign.status === 'active').length,
        recentUsers: users.slice(0, 5),
        recentPayments: invoices.filter((invoice) => invoice.status === 'paid').slice(0, 5),
        mrr: calculateMrr(subscriptions),
        healthScore,
        alerts,
        automationPlays,
        paymentReadiness: {
          stripe: paymentReady,
          webhookStored: Boolean(paymentSettings?.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET),
        },
        emailReadiness: emailCenter,
        platformDistribution: platformDistributionMap,
      },
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Error fetching statistics' }, { status: 500 });
  }
}
