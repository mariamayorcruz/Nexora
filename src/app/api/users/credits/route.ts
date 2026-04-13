import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAiPlanConfig, getCurrentCycleRange } from '@/lib/ai-studio';
import { getFounderPlan, isFounderEmail } from '@/lib/access';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const founderAccess = isFounderEmail(user.email);
    const founderPlan = founderAccess ? getFounderPlan() : null;
    const effectivePlan = founderPlan || user.subscription?.plan || 'starter';

    const { cycleKey, cycleStart, cycleEnd } = getCurrentCycleRange();
    const planConfig = getAiPlanConfig(effectivePlan, founderAccess);

    const usage = await prisma.aiWorkspaceUsage.upsert({
      where: {
        userId_cycleKey: {
          userId: user.id,
          cycleKey,
        },
      },
      update: {
        creditsIncluded: planConfig.monthlyCredits,
      },
      create: {
        userId: user.id,
        cycleKey,
        cycleStart,
        cycleEnd,
        creditsIncluded: planConfig.monthlyCredits,
      },
    });

    const planCredits = usage.creditsIncluded + usage.creditsPurchased;
    const available = Math.max(0, planCredits - usage.creditsUsed);

    return NextResponse.json({
      available,
      used: usage.creditsUsed,
      plan: planCredits,
      expires: usage.cycleEnd.toISOString(),
      cycleKey: usage.cycleKey,
    });
  } catch (error) {
    console.error('Error fetching credit balance:', error);
    return NextResponse.json({ error: 'Error fetching credit balance' }, { status: 500 });
  }
}
