import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

type TargetPlatform = keyof typeof PLATFORM_MAP;

const PLATFORM_MAP = {
  meta: ['facebook', 'instagram'],
  google: ['google'],
  tiktok: ['tiktok'],
} as const;

function normalizeBudget(value: unknown, fallback = 300) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(50, Math.min(50000, parsed));
}

function primaryPlatform(platform: TargetPlatform) {
  if (platform === 'google') return 'google';
  if (platform === 'tiktok') return 'tiktok';
  return 'instagram';
}

async function ensureLocalDraftAccount(userId: string, platform: 'instagram' | 'google' | 'tiktok') {
  const localAccountId = 'local-drafts';

  return prisma.adAccount.upsert({
    where: {
      userId_platform_accountId: {
        userId,
        platform,
        accountId: localAccountId,
      },
    },
    update: {
      accountName: 'Borradores Nexora',
      connected: false,
    },
    create: {
      userId,
      platform,
      accountId: localAccountId,
      accessToken: localAccountId,
      accountName: 'Borradores Nexora',
      connected: false,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyUserToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = (await request.json()) as {
      name?: string;
      platforms?: TargetPlatform[];
      budgetDaily?: number;
      description?: string;
    };

    const platforms: TargetPlatform[] = Array.isArray(body.platforms) && body.platforms.length > 0 ? body.platforms : ['meta'];
    const campaignName = String(body.name || '').trim() || 'Nueva campaña multicanal';
    const budgetDaily = normalizeBudget(body.budgetDaily);

    const connectedAccounts = await prisma.adAccount.findMany({
      where: { userId: decoded.userId, connected: true },
      orderBy: { createdAt: 'asc' },
    });

    const selectedAccounts = connectedAccounts.length > 0
      ? platforms.flatMap((platform) => {
      const accepted = new Set<string>(PLATFORM_MAP[platform] || []);
      const account = connectedAccounts.find((item) => accepted.has(item.platform));
      return account ? [account] : [];
      })
      : [];

    const fallbackAccounts = selectedAccounts.length === 0
      ? await Promise.all(
          platforms.map((platform) => ensureLocalDraftAccount(decoded.userId, primaryPlatform(platform)))
        )
      : [];

    const targetAccounts = selectedAccounts.length > 0 ? selectedAccounts : fallbackAccounts;
    const usingFallbackAccounts = selectedAccounts.length === 0;

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const createdCampaigns = await Promise.all(
      targetAccounts.map((account, idx) =>
        prisma.campaign.create({
          data: {
            userId: decoded.userId,
            adAccountId: account.id,
            name: targetAccounts.length > 1 ? `${campaignName} · ${account.platform.toUpperCase()}` : campaignName,
            description: body.description || 'Creada desde Command Center',
            budget: budgetDaily,
            startDate,
            endDate,
            status: usingFallbackAccounts ? 'draft' : 'active',
            targeting: {
              source: 'command-center',
              channel: account.platform,
              objective: 'conversion',
              launchWindow: '7-dias',
              slot: idx,
            },
          },
        })
      )
    );

    return NextResponse.json({
      ok: true,
      message: usingFallbackAccounts
        ? `Se crearon ${createdCampaigns.length} borrador(es) en Borradores Nexora. Puedes conectarlos luego desde "Conectar nuevo canal".`
        : `Se crearon ${createdCampaigns.length} campaña(s) desde Command Center.`,
      campaigns: createdCampaigns,
    });
  } catch (error) {
    console.error('Error creating unified campaign:', error);
    return NextResponse.json({ error: 'Error creating unified campaign' }, { status: 500 });
  }
}
