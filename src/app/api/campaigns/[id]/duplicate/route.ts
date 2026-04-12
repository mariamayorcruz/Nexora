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

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const original = await prisma.campaign.findFirst({
      where: { id: params.id, userId },
      include: { analytics: true },
    });

    if (!original) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const clone = await prisma.campaign.create({
      data: {
        userId,
        adAccountId: original.adAccountId,
        name: `${original.name} (Copia)`,
        description: original.description,
        budget: original.budget,
        startDate: new Date(),
        endDate: original.endDate,
        status: 'paused',
        targeting: original.targeting ?? undefined,
      },
    });

    if (original.analytics) {
      await prisma.analytics.create({
        data: {
          campaignId: clone.id,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          spend: 0,
          revenue: 0,
          ctr: 0,
          cpc: 0,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      campaign: clone,
      message: 'Campana duplicada correctamente.',
    });
  } catch (error) {
    console.error('Error duplicating campaign:', error);
    return NextResponse.json({ error: 'Error duplicating campaign' }, { status: 500 });
  }
}
