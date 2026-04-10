import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { buildAiOutput, getAiPlanConfig, getAiToolDefinition, type AiToolKey, AI_TOOL_DEFINITIONS, getCurrentCycleRange } from '@/lib/ai-studio';
import { getFounderPlan, isFounderEmail } from '@/lib/access';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

function getUserIdFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key') as { userId: string };
  return decoded.userId;
}

async function getUsageBucket(userId: string, plan: string | null | undefined, founderAccess: boolean) {
  const { cycleKey, cycleStart, cycleEnd } = getCurrentCycleRange();
  const planConfig = getAiPlanConfig(plan, founderAccess);

  const usage = await prisma.aiWorkspaceUsage.upsert({
    where: {
      userId_cycleKey: {
        userId,
        cycleKey,
      },
    },
    update: {
      creditsIncluded: planConfig.monthlyCredits,
    },
    create: {
      userId,
      cycleKey,
      cycleStart,
      cycleEnd,
      creditsIncluded: planConfig.monthlyCredits,
    },
  });

  return {
    usage,
    planConfig,
  };
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const founderAccess = isFounderEmail(user.email);
    const founderPlan = founderAccess ? getFounderPlan() : null;
    const { usage, planConfig } = await getUsageBucket(user.id, founderPlan || user.subscription?.plan, founderAccess);

    const jobs = await prisma.aiWorkspaceJob.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    const creditsTotal = usage.creditsIncluded + usage.creditsPurchased;

    return NextResponse.json({
      usage: {
        cycleKey: usage.cycleKey,
        cycleStart: usage.cycleStart,
        cycleEnd: usage.cycleEnd,
        creditsIncluded: usage.creditsIncluded,
        creditsPurchased: usage.creditsPurchased,
        creditsUsed: usage.creditsUsed,
        creditsRemaining: Math.max(0, creditsTotal - usage.creditsUsed),
        creditsTotal,
        supportLabel: planConfig.supportLabel,
        canUseVideoTools: planConfig.canUseVideoTools,
        maxExportsPerRun: planConfig.maxExportsPerRun,
      },
      tools: AI_TOOL_DEFINITIONS,
      jobs,
    });
  } catch (error) {
    console.error('Error fetching AI studio data:', error);
    return NextResponse.json({ error: 'Error fetching AI studio data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const tool = String(body.tool || 'ad-copy') as AiToolKey;
    const prompt = String(body.prompt || '').trim();
    const offer = String(body.offer || '').trim();
    const audience = String(body.audience || '').trim();
    const channel = String(body.channel || '').trim();

    if (!prompt || !offer) {
      return NextResponse.json({ error: 'La idea base y la oferta son obligatorias.' }, { status: 400 });
    }

    const founderAccess = isFounderEmail(user.email);
    const founderPlan = founderAccess ? getFounderPlan() : null;
    const { usage, planConfig } = await getUsageBucket(user.id, founderPlan || user.subscription?.plan, founderAccess);
    const toolDefinition = getAiToolDefinition(tool);

    if (tool === 'video-edit' && !planConfig.canUseVideoTools) {
      return NextResponse.json(
        { error: 'La edición de video con IA está disponible desde Growth en adelante.' },
        { status: 403 }
      );
    }

    const creditsTotal = usage.creditsIncluded + usage.creditsPurchased;
    const creditsRemaining = Math.max(0, creditsTotal - usage.creditsUsed);

    if (creditsRemaining < toolDefinition.credits) {
      return NextResponse.json(
        { error: 'No tienes créditos suficientes para esta acción. Sube de plan o espera al próximo ciclo.' },
        { status: 402 }
      );
    }

    const output = buildAiOutput({
      tool,
      prompt,
      offer,
      audience,
      channel,
    });
    const serializedOutput = JSON.parse(JSON.stringify(output)) as Prisma.InputJsonValue;

    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.aiWorkspaceJob.create({
        data: {
          userId: user.id,
          tool,
          title: output.headline,
          prompt,
          channel: channel || null,
          creditsUsed: toolDefinition.credits,
          output: serializedOutput,
        },
      });

      const updatedUsage = await tx.aiWorkspaceUsage.update({
        where: {
          userId_cycleKey: {
            userId: user.id,
            cycleKey: usage.cycleKey,
          },
        },
        data: {
          creditsUsed: {
            increment: toolDefinition.credits,
          },
          lastJobAt: new Date(),
        },
      });

      return { job, updatedUsage };
    });

    return NextResponse.json({
      job: result.job,
      usage: {
        cycleKey: result.updatedUsage.cycleKey,
        creditsIncluded: result.updatedUsage.creditsIncluded,
        creditsPurchased: result.updatedUsage.creditsPurchased,
        creditsUsed: result.updatedUsage.creditsUsed,
        creditsRemaining: Math.max(
          0,
          result.updatedUsage.creditsIncluded + result.updatedUsage.creditsPurchased - result.updatedUsage.creditsUsed
        ),
      },
    });
  } catch (error) {
    console.error('Error generating AI studio result:', error);
    return NextResponse.json({ error: 'Error generating AI studio result' }, { status: 500 });
  }
}
