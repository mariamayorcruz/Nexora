import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  AI_TOOL_DEFINITIONS,
  buildAiOutput,
  getAiPlanConfig,
  getAiToolDefinition,
  getCurrentCycleRange,
  type AiToolKey,
} from '@/lib/ai-studio';
import { getFounderPlan, isFounderEmail } from '@/lib/access';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

function getVideoRenderStatus() {
  const provider =
    process.env.VIDEO_RENDER_PROVIDER ||
    (process.env.HEYGEN_API_KEY ? 'heygen' : '') ||
    (process.env.RUNWAY_API_KEY ? 'runway' : '') ||
    (process.env.OPENAI_API_KEY ? 'openai' : '');
  const apiKey =
    process.env.VIDEO_RENDER_API_KEY ||
    process.env.HEYGEN_API_KEY ||
    process.env.RUNWAY_API_KEY ||
    process.env.OPENAI_API_KEY;

  return {
    ready: Boolean(provider && apiKey),
    provider: provider || null,
  };
}

function getUserIdFromRequest(request: NextRequest) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) {
    return null;
  }

  const decoded = verifyUserToken(token);
  return decoded?.userId || null;
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

  return { usage, planConfig };
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
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
    const videoRender = getVideoRenderStatus();

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
        videoRenderReady: videoRender.ready,
        videoRenderProvider: videoRender.provider,
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
    const sourceAsset = String(body.sourceAsset || '').trim();
    const outputFormat = String(body.outputFormat || '').trim();
    const captionStyle = String(body.captionStyle || '').trim();
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
    const { usage, planConfig } = await getUsageBucket(user.id, founderPlan || user.subscription?.plan, founderAccess);
    const toolDefinition = getAiToolDefinition(tool);
    const videoRender = getVideoRenderStatus();
    const isVideoTool = ['avatar-video', 'text-to-video', 'image-to-video', 'smart-edit'].includes(tool);

    if (isVideoTool && !planConfig.canUseVideoTools) {
      return NextResponse.json(
        { error: 'Las herramientas de video con IA están disponibles desde Growth en adelante.' },
        { status: 403 }
      );
    }

    if (isVideoTool && !videoRender.ready) {
      return NextResponse.json(
        {
          error:
            'El motor de render para video todavía no está conectado. No se consumieron créditos. Configura VIDEO_RENDER_PROVIDER y la API key del proveedor para habilitar avatar video, text-to-video, image-to-video o smart edit real.',
        },
        { status: 412 }
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
      sourceAsset,
      outputFormat,
      captionStyle,
      smartEditOptions,
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
