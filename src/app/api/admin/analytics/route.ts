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

    // Get platform distribution
    const platformStats = await prisma.campaign.groupBy({
      by: ['platform'],
      _count: {
        id: true,
      },
    });

    const totalCampaignsForPercentage = platformStats.reduce((sum, stat) => sum + stat._count.id, 0);
    const platformDistribution = platformStats.map(stat => ({
      platform: stat.platform,
      campaigns: stat._count.id,
      percentage: Math.round((stat._count.id / totalCampaignsForPercentage) * 100),
    }));

    // Get top performing campaigns (by conversions)
    const topPerformingCampaigns = await prisma.campaign.findMany({
      take: 10,
      orderBy: {
        conversions: 'desc',
      },
      select: {
        id: true,
        name: true,
        platform: true,
        spent: true,
        conversions: true,
      },
    });

    // Calculate ROI for each campaign
    const topCampaignsWithROI = topPerformingCampaigns.map(campaign => ({
      ...campaign,
      roi: campaign.spent > 0 ? Math.round((campaign.conversions / campaign.spent) * 100) : 0,
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
