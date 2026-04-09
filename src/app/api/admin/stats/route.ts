import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/admin';

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    // Get total users
    const totalUsers = await prisma.user.count();

    // Get active subscriptions
    const activeSubscriptions = await prisma.subscription.count({
      where: { status: 'active' },
    });

    // Get total revenue (from invoices)
    const totalRevenueResult = await prisma.invoice.aggregate({
      _sum: { amount: true },
      where: { status: 'paid' },
    });
    const totalRevenue = totalRevenueResult._sum.amount || 0;

    // Get monthly revenue (current month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyRevenueResult = await prisma.invoice.aggregate({
      _sum: { amount: true },
      where: {
        status: 'paid',
        createdAt: { gte: startOfMonth },
      },
    });
    const monthlyRevenue = monthlyRevenueResult._sum.amount || 0;

    // Get campaigns stats
    const totalCampaigns = await prisma.campaign.count();
    const activeCampaigns = await prisma.campaign.count({
      where: { status: 'active' },
    });

    // Get recent users
    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    // Get recent payments
    const recentPayments = await prisma.invoice.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      where: { status: 'paid' },
      include: {
        user: {
          select: { email: true },
        },
      },
    });

    return NextResponse.json({
      stats: {
        totalUsers,
        activeSubscriptions,
        totalRevenue,
        monthlyRevenue,
        totalCampaigns,
        activeCampaigns,
        recentUsers,
        recentPayments,
      },
    });
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Error fetching statistics' },
      { status: 500 }
    );
  }
}
