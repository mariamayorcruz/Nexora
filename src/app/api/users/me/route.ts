import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key') as any;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        subscription: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const adAccounts = await prisma.adAccount.findMany({
      where: { userId: user.id },
    });

    const campaigns = await prisma.campaign.findMany({
      where: { userId: user.id },
      include: { analytics: true },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscription: user.subscription,
      },
      adAccounts,
      campaigns,
    });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Error fetching user data' },
      { status: 500 }
    );
  }
}
