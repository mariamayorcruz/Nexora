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

    const body = (await request.json().catch(() => ({}))) as { action?: 'pause' | 'resume' };
    const action = body.action === 'resume' ? 'resume' : 'pause';

    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, userId: decoded.userId },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const nextStatus = action === 'pause' ? 'paused' : 'active';

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: nextStatus },
    });

    return NextResponse.json({
      ok: true,
      action,
      campaign: updated,
      message: action === 'pause' ? 'Campaña pausada en Nexora.' : 'Campaña reactivada en Nexora.',
    });
  } catch (error) {
    console.error('Error updating campaign status:', error);
    return NextResponse.json({ error: 'Error updating campaign status' }, { status: 500 });
  }
}
