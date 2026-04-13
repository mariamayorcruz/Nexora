import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  AI_TOOL_DEFINITIONS,
  buildAiOutput,
  type ContentFormat,
  type ContentPlatform,
  type ContentTone,
  getAiPlanConfig,
  getAiToolDefinition,
  getCurrentCycleRange,
  regenerateAiOutputBeat,
  type AiToolKey,
} from '@/lib/ai-studio';
import { getFounderPlan, isFounderEmail } from '@/lib/access';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

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

  return { usage, planConfig };
}

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
      },
      tools: AI_TOOL_DEFINITIONS,
      jobs,
    });
  } catch (error) {
    console.error('Error fetching Nexora Studio data:', error);
    return NextResponse.json({ error: 'Error fetching Nexora Studio data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const tool = String(body.tool || 'ad-copy') as AiToolKey;
    const prompt = String(body.prompt || '').trim();
    const offer = String(body.offer || '').trim();
    const audience = String(body.audience || '').trim();
    const channel = String(body.channel || '').trim();
    const tone = String(body.tone || 'viral-aggressive') as ContentTone;
    const format = String(body.format || 'full-script') as ContentFormat;
    const platform = String(body.platform || 'instagram-reels') as ContentPlatform;
    const duration = Number(body.duration || 30) as 15 | 30 | 60;
    const regenerate = String(body.regenerate || '').trim() as 'hook' | 'conflict' | 'resolution' | 'cta' | '';
    const currentOutput = body.currentOutput as Prisma.JsonObject | undefined;
    const sourceAsset = String(body.sourceAsset || '').trim();
    const outputFormat = String(body.outputFormat || '').trim();
    const captionStyle = String(body.captionStyle || '').trim();
    const storedPrompt = [prompt, `tone:${tone}`, `format:${format}`, `platform:${platform}`, `duration:${duration}`].join(' | ');
    const smartEditOptions = {
      removeSilences: Boolean(body.removeSilences),
      addMusic: Boolean(body.addMusic),
      createCaptions: Boolean(body.createCaptions),
      generateVariants: Boolean(body.generateVariants),
    };

    if (!prompt || !offer) {
      return NextResponse.json({ error: 'La idea base y la oferta son obligatorias.' }, { status: 400 });
    }

    const founderAccess = isFounderEmail(user.email);
    const founderPlan = founderAccess ? getFounderPlan() : null;
    const { usage } = await getUsageBucket(user.id, founderPlan || user.subscription?.plan, founderAccess);
    const toolDefinition = getAiToolDefinition(tool);
    const creditsCost = regenerate ? 5 : toolDefinition.credits;

    const creditsTotal = usage.creditsIncluded + usage.creditsPurchased;
    const creditsRemaining = Math.max(0, creditsTotal - usage.creditsUsed);

    if (!regenerate) {
      const duplicateWindowMs = 90 * 1000;
      const duplicateCandidate = await prisma.aiWorkspaceJob.findFirst({
        where: {
          userId: user.id,
          tool,
          prompt: storedPrompt,
          channel: channel || null,
          createdAt: {
            gte: new Date(Date.now() - duplicateWindowMs),
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (duplicateCandidate) {
        return NextResponse.json({
          reused: true,
          job: duplicateCandidate,
          usage: {
            cycleKey: usage.cycleKey,
            creditsIncluded: usage.creditsIncluded,
            creditsPurchased: usage.creditsPurchased,
            creditsUsed: usage.creditsUsed,
            creditsRemaining,
          },
        });
      }
    }

    if (creditsRemaining < creditsCost) {
      return NextResponse.json(
        { error: 'No tienes créditos suficientes para esta acción. Sube de plan o espera al próximo ciclo.' },
        { status: 402 }
      );
    }

    const output = regenerate
      ? regenerateAiOutputBeat({
          output: currentOutput as unknown as Parameters<typeof regenerateAiOutputBeat>[0]['output'],
          target: regenerate,
          offer,
          audience,
        })
      : buildAiOutput({
          tool,
          prompt,
          offer,
          audience,
          channel,
          tone,
          format,
          platform,
          duration,
          sourceAsset,
          outputFormat,
          captionStyle,
          smartEditOptions,
        });

    if (!output?.headline || (!output?.bullets?.length && !output?.slides?.length && !output?.sections?.length)) {
      return NextResponse.json(
        { error: 'No se pudo construir una respuesta valida. Intenta con un brief mas especifico.' },
        { status: 422 }
      );
    }

    const serializedOutput = JSON.parse(JSON.stringify(output)) as Prisma.InputJsonValue;

    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.aiWorkspaceJob.create({
        data: {
          userId: user.id,
          tool,
          title: output.headline,
          prompt: regenerate ? `${storedPrompt} | regenerate:${regenerate}` : storedPrompt,
          channel: channel || null,
          creditsUsed: creditsCost,
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
            increment: creditsCost,
          },
          lastJobAt: new Date(),
        },
      });

      return { job, updatedUsage };
    });

    return NextResponse.json({
      reused: false,
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
    console.error('Error generating Nexora Studio result:', error);
    return NextResponse.json({ error: 'Error generating Nexora Studio result' }, { status: 500 });
  }
}
