import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { isFounderEmail } from '@/lib/access';
import { buildAiSupportReply } from '@/lib/customer-success';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key') as { userId: string };
    const { message } = (await request.json()) as { message?: string };

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Describe tu duda para poder ayudarte.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        subscription: true,
        adAccounts: true,
        campaigns: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const reply = buildAiSupportReply(message, {
      name: user.name,
      plan: user.subscription?.plan || null,
      founderAccess: isFounderEmail(user.email),
      adAccountsCount: user.adAccounts.length,
      activeCampaigns: user.campaigns.filter((campaign) => campaign.status === 'active').length,
    });

    return NextResponse.json({
      reply,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@nexora.com',
    });
  } catch (error) {
    console.error('Support assistant error:', error);
    return NextResponse.json({ error: 'No pudimos responder desde soporte IA en este momento.' }, { status: 500 });
  }
}
