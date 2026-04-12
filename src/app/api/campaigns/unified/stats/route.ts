import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

function normalizePlatform(platform: string): 'meta' | 'google' | 'tiktok' {
  if (platform === 'instagram' || platform === 'facebook') {
    return 'meta';
  }

  if (platform === 'google') {
    return 'google';
  }

  return 'tiktok';
}

function normalizeStatus(status: string): 'active' | 'paused' | 'review' | 'ended' {
  if (status === 'active') return 'active';
  if (status === 'paused') return 'paused';
  if (status === 'completed') return 'ended';
  return 'review';
}

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

    const [adAccounts, campaigns] = await Promise.all([
      prisma.adAccount.findMany({
        where: {
          userId: decoded.userId,
          connected: true,
          NOT: { accountId: { startsWith: 'demo-' } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.campaign.findMany({
        where: {
          userId: decoded.userId,
          NOT: { status: 'draft' },
          adAccount: {
            connected: true,
            NOT: { accountId: { startsWith: 'demo-' } },
          },
        },
        include: { analytics: true, adAccount: true },
        orderBy: { updatedAt: 'desc' },
        take: 60,
      }),
    ]);

    const unifiedCampaigns = campaigns.map((campaign) => {
      const spend = campaign.analytics?.spend || 0;
      const revenue = campaign.analytics?.revenue || 0;
      const conversions = campaign.analytics?.conversions || 0;
      const roas = spend > 0 ? revenue / spend : 0;
      const cpa = conversions > 0 ? spend / conversions : spend;
      const scheduleEnd = campaign.endDate || new Date(campaign.startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

      return {
        id: campaign.id,
        name: campaign.name,
        status: normalizeStatus(campaign.status),
        channel: {
          platform: normalizePlatform(campaign.adAccount.platform),
          accountName: campaign.adAccount.accountName,
          accountId: campaign.adAccount.accountId,
        },
        metrics: {
          spend,
          impressions: campaign.analytics?.impressions || 0,
          clicks: campaign.analytics?.clicks || 0,
          conversions,
          roas,
          cpa,
        },
        creative: {
          type: 'video' as const,
          thumbnail: null,
          studioProjectId: undefined,
        },
        budget: {
          daily: campaign.budget,
          total: campaign.budget * 30,
          spent: spend,
          remaining: Math.max(0, campaign.budget - spend),
        },
        schedule: {
          start: campaign.startDate.toISOString(),
          end: scheduleEnd.toISOString(),
        },
        actions: ['pause', 'resume', 'duplicate', 'edit', 'delete'] as const,
      };
    });

    const channels = adAccounts.map((account) => {
      const accountCampaigns = unifiedCampaigns.filter((campaign) => campaign.channel.accountId === account.accountId);
      const spendToday = accountCampaigns.reduce((acc, campaign) => acc + campaign.metrics.spend, 0);
      const activeCampaigns = accountCampaigns.filter((campaign) => campaign.status === 'active').length;

      return {
        id: account.id,
        platform: normalizePlatform(account.platform),
        accountName: account.accountName,
        accountId: account.accountId,
        connected: account.connected,
        spendToday,
        activeCampaigns,
      };
    });

    const totals = unifiedCampaigns.reduce(
      (acc, campaign) => {
        acc.spendToday += campaign.metrics.spend;
        acc.revenue += campaign.metrics.spend * campaign.metrics.roas;
        acc.impressions += campaign.metrics.impressions;
        acc.clicks += campaign.metrics.clicks;
        acc.conversions += campaign.metrics.conversions;
        return acc;
      },
      {
        spendToday: 0,
        revenue: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
      }
    );

    const roas = totals.spendToday > 0 ? totals.revenue / totals.spendToday : 0;
    const cpa = totals.conversions > 0 ? totals.spendToday / totals.conversions : totals.spendToday;

    return NextResponse.json({
      campaigns: unifiedCampaigns,
      channels,
      totals: {
        ...totals,
        roas,
        cpa,
      },
    });
  } catch (error) {
    console.error('Error fetching unified campaign stats:', error);
    return NextResponse.json({ error: 'Error fetching unified campaign stats' }, { status: 500 });
  }
}
