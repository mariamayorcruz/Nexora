import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isFounderEmail } from '@/lib/access';
import { buildAiSupportReply } from '@/lib/customer-success';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyUserToken(token);
    if (!decoded?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const { message, page } = (await request.json()) as { message?: string; page?: string };

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

    const contextualMessage = page ? `${message}\n\nContexto actual del usuario: ${page}` : message;

    const reply = buildAiSupportReply(contextualMessage, {
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
