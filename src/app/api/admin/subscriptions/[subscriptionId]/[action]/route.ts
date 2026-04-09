import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { subscriptionId: string; action: string } }
) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  const { subscriptionId, action } = params;

  try {
    switch (action) {
      case 'pause':
        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: { status: 'paused' },
        });
        break;

      case 'resume':
        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: { status: 'active' },
        });
        break;

      case 'cancel':
        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: { status: 'cancelled' },
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
    console.error('Error performing subscription action:', error);
    return NextResponse.json(
      { error: 'Error performing action' },
      { status: 500 }
    );
  }
}
