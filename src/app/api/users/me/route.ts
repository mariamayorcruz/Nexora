import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFounderPlan, getFounderTrialDays, isAdminEmail, isFounderEmail } from '@/lib/access';
import { buildEntitlementSummary } from '@/lib/entitlements';
import { getHigherTierPlan } from '@/lib/billing';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyUserToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

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
    const adminAccess = isAdminEmail(user.email) || founderAccess;
    const founderPlan = founderAccess ? getFounderPlan() : null;
    const effectivePlan = founderAccess
      ? getHigherTierPlan(founderPlan, user.subscription?.plan)
      : user.subscription?.plan || 'starter';

    if (
      founderAccess &&
      user.subscription &&
      (user.subscription.plan !== effectivePlan || user.subscription.currentPeriodEnd < new Date())
    ) {
      const upgradedPeriodEnd = new Date();
      upgradedPeriodEnd.setDate(upgradedPeriodEnd.getDate() + getFounderTrialDays());

      const updatedSubscription = await prisma.subscription.update({
        where: { userId: user.id },
        data: {
          plan: effectivePlan || user.subscription.plan,
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

    const entitlements = buildEntitlementSummary(effectivePlan, {
      adAccounts: adAccounts.length,
      activeCampaigns: campaigns.filter((campaign) => campaign.status === 'active').length,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscription: user.subscription,
        isAdmin: adminAccess,
        founderAccess,
        founderPlan: effectivePlan,
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
