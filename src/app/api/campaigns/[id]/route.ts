import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeNexoraCreative } from '@/lib/nexora-creative';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

function normalizeBudget(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(50, Math.min(50000, numeric));
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, userId },
      include: { adAccount: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const body = (await request.json()) as {
      name?: string;
      description?: string;
      budget?: number;
      status?: string;
      creative?: {
        imageUrl?: string;
        primaryText?: string;
        headline?: string;
        description?: string;
        cta?: string;
        variant?: string;
      };
    };

    const nextBudget = body.budget !== undefined ? normalizeBudget(body.budget) : null;
    if (body.budget !== undefined && nextBudget === null) {
      return NextResponse.json({ error: 'Presupuesto invalido.' }, { status: 400 });
    }

    const nextStatus = String(body.status || '').trim().toLowerCase();
    const allowedStatus = new Set(['active', 'paused', 'completed']);

    let resolvedAdAccountId: string | undefined;
    if (
      campaign.status === 'draft' &&
      nextStatus === 'active' &&
      allowedStatus.has(nextStatus) &&
      !campaign.adAccount.connected
    ) {
      const connectedAccounts = await prisma.adAccount.findMany({
        where: {
          userId,
          connected: true,
          NOT: { accountId: { startsWith: 'demo-' } },
        },
        orderBy: { createdAt: 'asc' },
      });

      const p = campaign.adAccount.platform;
      const match = connectedAccounts.find((a) => {
        if (p === 'google') return a.platform === 'google';
        if (p === 'tiktok') return a.platform === 'tiktok';
        return a.platform === 'instagram' || a.platform === 'facebook';
      });

      if (!match) {
        return NextResponse.json(
          {
            error:
              'Conecta un canal publicitario compatible (Meta, Google o TikTok) antes de activar este borrador.',
          },
          { status: 400 }
        );
      }

      resolvedAdAccountId = match.id;
    }

    let nextTargeting: Prisma.InputJsonValue | undefined;
    if (body.creative !== undefined) {
      const base =
        campaign.targeting !== null &&
        typeof campaign.targeting === 'object' &&
        !Array.isArray(campaign.targeting)
          ? { ...(campaign.targeting as Record<string, unknown>) }
          : {};
      const nexoraCreative = normalizeNexoraCreative(body.creative);
      nextTargeting = { ...base, nexoraCreative } as Prisma.InputJsonValue;
    }

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        name: body.name?.trim() || campaign.name,
        description: body.description?.trim() || campaign.description,
        budget: nextBudget ?? campaign.budget,
        status: allowedStatus.has(nextStatus) ? nextStatus : campaign.status,
        ...(nextTargeting !== undefined ? { targeting: nextTargeting } : {}),
        ...(resolvedAdAccountId !== undefined ? { adAccountId: resolvedAdAccountId } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      campaign: updated,
      message:
        campaign.status === 'draft' && allowedStatus.has(nextStatus) && nextStatus === 'active'
          ? 'Campaña activada.'
          : undefined,
    });
  } catch (error) {
    console.error('Error updating campaign:', error);
    return NextResponse.json({ error: 'Error updating campaign' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, userId },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    await prisma.campaign.delete({ where: { id: campaign.id } });
    return NextResponse.json({ ok: true, message: 'Campana eliminada.' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return NextResponse.json({ error: 'Error deleting campaign' }, { status: 500 });
  }
}
