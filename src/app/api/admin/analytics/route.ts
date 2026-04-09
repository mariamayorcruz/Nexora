import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/admin';

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    // Get total revenue
    const totalRevenueResult = await prisma.invoice.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        status: 'paid',
      },
    });
    const totalRevenue = totalRevenueResult._sum.amount || 0;

    // Get total users
    const totalUsers = await prisma.user.count();

    // Get active subscriptions
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        status: 'active',
      },
    });

    // Get total campaigns
    const totalCampaigns = await prisma.campaign.count();

    // Get revenue by month (last 12 months)
    const revenueByMonth = await prisma.$queryRaw`
      SELECT
        DATE_TRUNC('month', "createdAt") as month,
        SUM(amount) as revenue
      FROM "Invoice"
      WHERE "status" = 'paid'
        AND "createdAt" >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month
    `;

    // Get users by month (last 12 months)
    const usersByMonth = await prisma.$queryRaw`
      SELECT
        DATE_TRUNC('month', "createdAt") as month,
        COUNT(*) as users
      FROM "User"
      WHERE "createdAt" >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month
    `;

    // Get platform distribution based on linked ad accounts
    const campaignsWithPlatform = await prisma.campaign.findMany({
      select: {
        id: true,
        adAccount: {
          select: {
            platform: true,
          },
        },
      },
    });

    const platformCounts = campaignsWithPlatform.reduce<Record<string, number>>((acc, campaign) => {
      const platform = campaign.adAccount.platform;
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {});

    const totalCampaignsForPercentage = campaignsWithPlatform.length || 1;
    const platformDistribution = Object.entries(platformCounts).map(([platform, campaigns]) => ({
      platform,
      campaigns,
      percentage: Math.round((campaigns / totalCampaignsForPercentage) * 100),
    }));

    // Get top performing campaigns from analytics records
    const topAnalytics = await prisma.analytics.findMany({
      take: 10,
      orderBy: {
        conversions: 'desc',
      },
      include: {
        campaign: {
          include: {
            adAccount: {
              select: {
                platform: true,
              },
            },
          },
        },
      },
    });

    const topCampaignsWithROI = topAnalytics.map((item) => ({
      id: item.campaign.id,
      name: item.campaign.name,
      platform: item.campaign.adAccount.platform,
      spent: item.spend,
      conversions: item.conversions,
      roi: item.spend > 0 ? Math.round((item.conversions / item.spend) * 100) : 0,
    }));

    return NextResponse.json({
      totalRevenue,
      totalUsers,
      activeSubscriptions,
      totalCampaigns,
      revenueByMonth,
      usersByMonth,
      platformDistribution,
      topPerformingCampaigns: topCampaignsWithROI,
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Error fetching analytics' },
      { status: 500 }
    );
  }
}
