import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFounderPlan, getFounderTrialDays, isAdminEmail, isFounderEmail } from '@/lib/access';
import { buildEntitlementSummary } from '@/lib/entitlements';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key') as any;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        subscription: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const founderAccess = isFounderEmail(user.email);
    const founderPlan = founderAccess ? getFounderPlan() : null;

    if (
      founderAccess &&
      user.subscription &&
      (user.subscription.plan !== founderPlan || user.subscription.currentPeriodEnd < new Date())
    ) {
      const upgradedPeriodEnd = new Date();
      upgradedPeriodEnd.setDate(upgradedPeriodEnd.getDate() + getFounderTrialDays());

      const updatedSubscription = await prisma.subscription.update({
        where: { userId: user.id },
        data: {
          plan: founderPlan || user.subscription.plan,
          status: 'active',
          currentPeriodEnd: upgradedPeriodEnd,
        },
      });

      user.subscription = updatedSubscription;
    }

    const adAccounts = await prisma.adAccount.findMany({
      where: { userId: user.id },
    });

    const campaigns = await prisma.campaign.findMany({
      where: { userId: user.id },
      include: {
        analytics: true,
        adAccount: {
          select: {
            platform: true,
            accountName: true,
          },
        },
      },
    });

    const entitlements = buildEntitlementSummary(founderPlan || user.subscription?.plan, {
      adAccounts: adAccounts.length,
      activeCampaigns: campaigns.filter((campaign) => campaign.status === 'active').length,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscription: user.subscription,
        isAdmin: isAdminEmail(user.email),
        founderAccess,
        founderPlan,
        entitlements,
      },
      adAccounts,
      campaigns,
    });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Error fetching user data' },
      { status: 500 }
    );
  }
}
