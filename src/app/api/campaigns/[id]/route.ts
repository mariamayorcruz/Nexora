import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

function getUserIdFromRequest(request: NextRequest) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) return null;
  const decoded = verifyUserToken(token);
  return decoded?.userId || null;
}

function normalizeBudget(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(50, Math.min(50000, numeric));
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, userId },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const body = (await request.json()) as {
      name?: string;
      description?: string;
      budget?: number;
      status?: string;
    };

    const nextBudget = body.budget !== undefined ? normalizeBudget(body.budget) : null;
    if (body.budget !== undefined && nextBudget === null) {
      return NextResponse.json({ error: 'Presupuesto invalido.' }, { status: 400 });
    }

    const nextStatus = String(body.status || '').trim().toLowerCase();
    const allowedStatus = new Set(['active', 'paused', 'completed']);

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        name: body.name?.trim() || campaign.name,
        description: body.description?.trim() || campaign.description,
        budget: nextBudget ?? campaign.budget,
        status: allowedStatus.has(nextStatus) ? nextStatus : campaign.status,
      },
    });

    return NextResponse.json({ ok: true, campaign: updated });
  } catch (error) {
    console.error('Error updating campaign:', error);
    return NextResponse.json({ error: 'Error updating campaign' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = getUserIdFromRequest(request);
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
