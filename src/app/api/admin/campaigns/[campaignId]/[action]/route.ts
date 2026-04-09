import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: { campaignId: string; action: string } }
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  const { campaignId, action } = params;

  try {
    switch (action) {
      case 'pause':
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'paused' },
        });
        break;

      case 'resume':
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'active' },
        });
        break;

      case 'stop':
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'stopped' },
        });
        break;

      case 'view':
        // For view action, we could return detailed campaign data
        // For now, just return success
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error performing campaign action:', error);
    return NextResponse.json(
      { error: 'Error performing action' },
      { status: 500 }
    );
  }
}
