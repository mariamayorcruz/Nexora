import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = getBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyUserToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, userId: decoded.userId },
      include: { analytics: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (!campaign.analytics) {
      const created = await prisma.analytics.create({
        data: {
          campaignId: campaign.id,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          spend: 0,
          revenue: 0,
        },
      });

      return NextResponse.json({
        ok: true,
        syncedAt: new Date().toISOString(),
        analytics: created,
        message: 'Métricas inicializadas para sincronización futura.',
      });
    }

    const analytics = await prisma.analytics.update({
      where: { campaignId: campaign.id },
      data: {
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      analytics,
      message: 'Campaña sincronizada correctamente.',
    });
  } catch (error) {
    console.error('Error syncing campaign:', error);
    return NextResponse.json({ error: 'Error syncing campaign' }, { status: 500 });
  }
}
