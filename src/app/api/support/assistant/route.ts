import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isFounderEmail } from '@/lib/access';
import { buildAiSupportReply } from '@/lib/customer-success';
import { buildClaudeSupportReply, buildGeminiSupportReply, buildGroqSupportReply, buildOpenRouterSupportReply } from '@/lib/support-llm';
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
    const { message, page, aiProvider, aiApiKey } = (await request.json()) as {
      message?: string;
      page?: string;
      aiProvider?: 'auto' | 'heuristic' | 'claude' | 'gemini' | 'openrouter' | 'groq';
      aiApiKey?: string;
    };

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

    const supportContext = {
      name: user.name,
      plan: user.subscription?.plan || null,
      founderAccess: isFounderEmail(user.email),
      adAccountsCount: user.adAccounts.length,
      activeCampaigns: user.campaigns.filter((campaign) => campaign.status === 'active').length,
    };

    const workspaceConfig = await prisma.adminWorkspaceConfig.findUnique({ where: { key: 'main' } });
    const platformConfig = (workspaceConfig?.platformConfig || {}) as Record<string, unknown>;

    const provider = aiProvider || 'auto';
    const byok = String(aiApiKey || '').trim();
    const platformKey =
      String(platformConfig.anthropicApiKey || '').trim() || String(process.env.ANTHROPIC_API_KEY || '').trim();
    const platformGeminiKey =
      String(platformConfig.geminiApiKey || '').trim() || String(process.env.GEMINI_API_KEY || '').trim();
    const platformOpenRouterKey =
      String(platformConfig.openRouterApiKey || '').trim() || String(process.env.OPENROUTER_API_KEY || '').trim();
    const platformGroqKey =
      String(platformConfig.groqApiKey || '').trim() || String(process.env.GROQ_API_KEY || '').trim();

    let providerUsed: 'claude' | 'gemini' | 'openrouter' | 'groq' | 'heuristic' = 'heuristic';
    let llmReply = null;

    if (provider === 'claude') {
      const claudeKey = byok || platformKey;
      if (claudeKey) {
        llmReply = await buildClaudeSupportReply({
          message: contextualMessage,
          context: supportContext,
          apiKey: claudeKey,
        });
        if (llmReply) providerUsed = 'claude';
      }
    } else if (provider === 'gemini') {
      const geminiKey = byok || platformGeminiKey;
      if (geminiKey) {
        llmReply = await buildGeminiSupportReply({
          message: contextualMessage,
          context: supportContext,
          apiKey: geminiKey,
        });
        if (llmReply) providerUsed = 'gemini';
      }
    } else if (provider === 'openrouter') {
      const openRouterKey = byok || platformOpenRouterKey;
      if (openRouterKey) {
        llmReply = await buildOpenRouterSupportReply({
          message: contextualMessage,
          context: supportContext,
          apiKey: openRouterKey,
        });
        if (llmReply) providerUsed = 'openrouter';
      }
    } else if (provider === 'groq') {
      const groqKey = byok || platformGroqKey;
      if (groqKey) {
        llmReply = await buildGroqSupportReply({
          message: contextualMessage,
          context: supportContext,
          apiKey: groqKey,
        });
        if (llmReply) providerUsed = 'groq';
      }
    } else if (provider === 'auto') {
      // Cadena: Claude → Gemini → OpenRouter (gratis) → heurístico
      const claudeKey = byok || platformKey;
      if (claudeKey) {
        llmReply = await buildClaudeSupportReply({
          message: contextualMessage,
          context: supportContext,
          apiKey: claudeKey,
        });
        if (llmReply) providerUsed = 'claude';
      }

      if (!llmReply) {
        const geminiKey = platformGeminiKey;
        if (geminiKey) {
          llmReply = await buildGeminiSupportReply({
            message: contextualMessage,
            context: supportContext,
            apiKey: geminiKey,
          });
          if (llmReply) providerUsed = 'gemini';
        }
      }

      if (!llmReply) {
        const openRouterKey = platformOpenRouterKey;
        if (openRouterKey) {
          llmReply = await buildOpenRouterSupportReply({
            message: contextualMessage,
            context: supportContext,
            apiKey: openRouterKey,
          });
          if (llmReply) providerUsed = 'openrouter';
        }
      }

      if (!llmReply) {
        const groqKey = platformGroqKey;
        if (groqKey) {
          llmReply = await buildGroqSupportReply({
            message: contextualMessage,
            context: supportContext,
            apiKey: groqKey,
          });
          if (llmReply) providerUsed = 'groq';
        }
      }
    }

    const reply = llmReply || buildAiSupportReply(contextualMessage, supportContext);

    return NextResponse.json({
      reply,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@nexora.com',
      ai: {
        providerUsed,
        byokActive: Boolean(byok),
      },
    });
  } catch (error) {
    console.error('Support assistant error:', error);
    return NextResponse.json({ error: 'No pudimos responder desde soporte IA en este momento.' }, { status: 500 });
  }
}
