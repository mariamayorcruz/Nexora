import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string; action: string } }
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  const { userId, action } = params;

  try {
    switch (action) {
      case 'suspend':
        await prisma.subscription.updateMany({
          where: { userId },
          data: { status: 'paused' },
        });
        break;

      case 'activate':
        await prisma.subscription.updateMany({
          where: { userId },
          data: { status: 'active' },
        });
        break;

      case 'delete':
        // Delete in correct order due to foreign keys
        await prisma.analytics.deleteMany({
          where: { campaign: { userId } },
        });
        await prisma.campaign.deleteMany({
          where: { userId },
        });
        await prisma.adAccount.deleteMany({
          where: { userId },
        });
        await prisma.invoice.deleteMany({
          where: { userId },
        });
        await prisma.subscription.deleteMany({
          where: { userId },
        });
        await prisma.user.delete({
          where: { id: userId },
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error performing user action:', error);
    return NextResponse.json(
      { error: 'Error performing action' },
      { status: 500 }
    );
  }
}
