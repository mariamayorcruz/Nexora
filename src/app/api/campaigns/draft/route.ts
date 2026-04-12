import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

function normalizeText(value: unknown, fallback: string) {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeBudget(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 250;
  return Math.max(50, Math.min(100000, parsed));
}

function inferPlatformFromChannel(channel: string) {
  const normalized = channel.toLowerCase();
  if (normalized.includes('google')) return 'google';
  if (normalized.includes('tiktok')) return 'tiktok';
  if (normalized.includes('facebook')) return 'facebook';
  return 'instagram';
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
      objective?: string;
      channel?: string;
      budget?: number;
      launchWindow?: string;
      adAccountId?: string;
      hook?: string;
      promise?: string;
      cta?: string;
      angle?: string;
      checklist?: string[];
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const adAccounts = await prisma.adAccount.findMany({
      where: { userId: user.id, connected: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, platform: true, accountName: true },
    });

    const channel = normalizeText(body.channel, 'multiplataforma');

    let targetAccount =
      body.adAccountId && adAccounts.some((account) => account.id === body.adAccountId)
        ? adAccounts.find((account) => account.id === body.adAccountId)!
        : adAccounts[0];

    if (!targetAccount) {
      const inferredPlatform = inferPlatformFromChannel(channel);
      const localAccountId = 'local-drafts';

      const fallbackAccount = await prisma.adAccount.upsert({
        where: {
          userId_platform_accountId: {
            userId: user.id,
            platform: inferredPlatform,
            accountId: localAccountId,
          },
        },
        update: {
          accountName: 'Borradores Nexora',
          connected: false,
        },
        create: {
          userId: user.id,
          platform: inferredPlatform,
          accountId: localAccountId,
          accessToken: localAccountId,
          accountName: 'Borradores Nexora',
          connected: false,
        },
        select: {
          id: true,
          platform: true,
          accountName: true,
        },
      });

      targetAccount = fallbackAccount;
    }

    const objective = normalizeText(body.objective, 'conversiones');
    const normalizedChannel = normalizeText(channel, targetAccount.platform || 'multiplataforma');
    const campaignName = normalizeText(body.name, `Campana ${objective} ${normalizedChannel}`);
    const budget = normalizeBudget(body.budget);
    const launchWindow = normalizeText(body.launchWindow, '7-dias');
    const hook = normalizeText(body.hook, 'Hook pendiente por definir');
    const promise = normalizeText(body.promise, 'Promesa pendiente por definir');
    const cta = normalizeText(body.cta, 'CTA pendiente por definir');
    const angle = normalizeText(body.angle, 'Angulo pendiente por definir');
    const checklist = Array.isArray(body.checklist)
      ? body.checklist.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 10)
      : [];

    const campaign = await prisma.campaign.create({
      data: {
        userId: user.id,
        adAccountId: targetAccount.id,
        name: campaignName,
        description: `Borrador IA · Objetivo: ${objective} · Canal: ${normalizedChannel} · Ventana: ${launchWindow} · Hook: ${hook} · CTA: ${cta}`,
        budget,
        startDate: new Date(),
        status: 'draft',
        targeting: {
          source: 'ai-chatbot',
          objective,
          channel: normalizedChannel,
          launchWindow,
          hook,
          promise,
          cta,
          angle,
          checklist,
        },
      },
      include: {
        adAccount: {
          select: {
            platform: true,
            accountName: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      campaign,
      message: 'Borrador de campana creado desde el asistente IA.',
    });
  } catch (error) {
    console.error('Create campaign draft error:', error);
    return NextResponse.json({ error: 'No se pudo crear el borrador de campana.' }, { status: 500 });
  }
}
