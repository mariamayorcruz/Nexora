import { NextRequest, NextResponse } from 'next/server';
import { isFounderEmail } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { canAccessRadar, getPlanCapabilities } from '@/lib/entitlements';
import { buildTrendRadarReport } from '@/lib/trends';
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
        adAccounts: {
          orderBy: { createdAt: 'desc' },
        },
        campaigns: {
          orderBy: { createdAt: 'desc' },
          include: { analytics: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const effectivePlan = isFounderEmail(user.email) ? 'enterprise' : user.subscription?.plan;
    if (!canAccessRadar(effectivePlan)) {
      const capabilities = getPlanCapabilities(effectivePlan);
      return NextResponse.json(
        {
          error: 'El radar creativo esta disponible desde el plan Growth.',
          capabilities,
        },
        { status: 403 }
      );
    }

    const report = buildTrendRadarReport({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        founderAccess: isFounderEmail(user.email),
        subscription: user.subscription
          ? {
              plan: user.subscription.plan,
              status: user.subscription.status,
            }
          : null,
      },
      adAccounts: user.adAccounts.map((account) => ({
        id: account.id,
        platform: account.platform,
        accountName: account.accountName,
        connected: account.connected,
      })),
      campaigns: user.campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        budget: campaign.budget,
        analytics: campaign.analytics
          ? {
              impressions: campaign.analytics.impressions,
              clicks: campaign.analytics.clicks,
              conversions: campaign.analytics.conversions,
              spend: campaign.analytics.spend,
              revenue: campaign.analytics.revenue,
            }
          : null,
      })),
    });

    return NextResponse.json({
      report,
    });
  } catch (error) {
    console.error('Trend radar error:', error);
    return NextResponse.json(
      { error: 'No se pudo generar el radar creativo en este momento.' },
      { status: 500 }
    );
  }
}
