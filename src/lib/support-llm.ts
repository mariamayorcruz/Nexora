import type { SuggestedReply } from '@/lib/customer-success';

interface ClaudeSupportContext {
  name?: string | null;
  plan?: string | null;
  founderAccess?: boolean;
  adAccountsCount: number;
  activeCampaigns: number;
}

const DEFAULT_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
// OpenRouter free models — rotamos para asegurar disponibilidad
const DEFAULT_OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-8b-instruct:free';
const OPENROUTER_FALLBACK_MODELS = [
  'meta-llama/llama-3.3-8b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'google/gemma-2-9b-it:free',
  'nousresearch/hermes-3-llama-3.1-8b:free',
];

function extractJsonObject(text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return trimmed.slice(first, last + 1);
  }

  return trimmed;
}

function safeReply(value: unknown): SuggestedReply | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SuggestedReply>;

  const title = String(candidate.title || '').trim();
  const message = String(candidate.message || '').trim();

  if (!title || !message) return null;

  const nextSteps = Array.isArray(candidate.nextSteps)
    ? candidate.nextSteps.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 6)
    : [];

  const draft = candidate.campaignDraft;
  const campaignDraft =
    draft && typeof draft === 'object'
      ? {
          name: String((draft as SuggestedReply['campaignDraft'])?.name || '').trim(),
          objective: String((draft as SuggestedReply['campaignDraft'])?.objective || '').trim(),
          channel: String((draft as SuggestedReply['campaignDraft'])?.channel || '').trim(),
          budget: Number((draft as SuggestedReply['campaignDraft'])?.budget || 0),
          status: 'draft' as const,
          launchWindow: String((draft as SuggestedReply['campaignDraft'])?.launchWindow || '7-dias').trim(),
          hook: String((draft as SuggestedReply['campaignDraft'])?.hook || '').trim(),
          promise: String((draft as SuggestedReply['campaignDraft'])?.promise || '').trim(),
          cta: String((draft as SuggestedReply['campaignDraft'])?.cta || '').trim(),
          angle: String((draft as SuggestedReply['campaignDraft'])?.angle || '').trim(),
          checklist: Array.isArray((draft as SuggestedReply['campaignDraft'])?.checklist)
            ? ((draft as SuggestedReply['campaignDraft'])?.checklist || [])
                .map((item) => String(item || '').trim())
                .filter(Boolean)
                .slice(0, 8)
            : [],
        }
      : undefined;

  const validDraft =
    campaignDraft &&
    campaignDraft.name &&
    campaignDraft.objective &&
    campaignDraft.channel &&
    Number.isFinite(campaignDraft.budget) &&
    campaignDraft.budget > 0
      ? campaignDraft
      : undefined;

  return {
    title,
    message,
    nextSteps,
    campaignDraft: validDraft,
  };
}

export async function buildClaudeSupportReply(params: {
  message: string;
  context: ClaudeSupportContext;
  apiKey: string;
  model?: string;
}): Promise<SuggestedReply | null> {
  const { message, context, apiKey, model } = params;
  const cleanKey = apiKey.trim();
  if (!cleanKey) return null;

  const system = [
    'You are Nexora Support AI for Spanish-speaking SaaS users.',
    'Return STRICT JSON only with keys: title, message, nextSteps, campaignDraft.',
    'nextSteps must be an array of concise Spanish action steps.',
    'campaignDraft is optional and must be null or an object with: name, objective, channel, budget, status, launchWindow, hook, promise, cta, angle, checklist.',
    'Use status exactly "draft" if campaignDraft exists.',
    'Never include markdown fences or explanations outside JSON.',
  ].join(' ');

  const userPrompt = JSON.stringify(
    {
      userMessage: message,
      context: {
        name: context.name || null,
        plan: context.plan || null,
        founderAccess: Boolean(context.founderAccess),
        adAccountsCount: context.adAccountsCount,
        activeCampaigns: context.activeCampaigns,
      },
      style: {
        language: 'es',
        tone: 'accionable, concreto, directo',
      },
      constraints: [
        'No inventes datos de facturacion que no esten en contexto.',
        'Prioriza pasos concretos dentro de Nexora.',
        'Si el usuario pide crear campaña, puedes devolver campaignDraft.',
      ],
    },
    null,
    2
  );

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cleanKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 900,
      temperature: 0.2,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const text = (payload.content || [])
    .filter((item) => item.type === 'text' && item.text)
    .map((item) => item.text || '')
    .join('\n')
    .trim();

  if (!text) return null;

  try {
    const parsed = JSON.parse(extractJsonObject(text));
    return safeReply(parsed);
  } catch {
    return null;
  }
}

export async function buildGeminiSupportReply(params: {
  message: string;
  context: ClaudeSupportContext;
  apiKey: string;
  model?: string;
}): Promise<SuggestedReply | null> {
  const { message, context, apiKey, model } = params;
  const cleanKey = apiKey.trim();
  if (!cleanKey) return null;

  const system = [
    'You are Nexora Support AI for Spanish-speaking SaaS users.',
    'Return STRICT JSON only with keys: title, message, nextSteps, campaignDraft.',
    'nextSteps must be an array of concise Spanish action steps.',
    'campaignDraft is optional and must be null or an object with: name, objective, channel, budget, status, launchWindow, hook, promise, cta, angle, checklist.',
    'Use status exactly "draft" if campaignDraft exists.',
    'Never include markdown fences or explanations outside JSON.',
  ].join(' ');

  const userPrompt = JSON.stringify(
    {
      userMessage: message,
      context: {
        name: context.name || null,
        plan: context.plan || null,
        founderAccess: Boolean(context.founderAccess),
        adAccountsCount: context.adAccountsCount,
        activeCampaigns: context.activeCampaigns,
      },
      style: {
        language: 'es',
        tone: 'accionable, concreto, directo',
      },
      constraints: [
        'No inventes datos de facturacion que no esten en contexto.',
        'Prioriza pasos concretos dentro de Nexora.',
        'Si el usuario pide crear campaña, puedes devolver campaignDraft.',
      ],
    },
    null,
    2
  );

  const targetModel = model || DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(cleanKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: system }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 900,
      },
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = (payload.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || '')
    .join('\n')
    .trim();

  if (!text) return null;

  try {
    const parsed = JSON.parse(extractJsonObject(text));
    return safeReply(parsed);
  } catch {
    return null;
  }
}

// ── OpenRouter (modelos gratuitos) ──────────────────────────────────────────
// Docs: https://openrouter.ai/docs — OpenAI-compatible, no requiere tarjeta para free tier
export async function buildOpenRouterSupportReply(params: {
  message: string;
  context: ClaudeSupportContext;
  apiKey: string;
  model?: string;
}): Promise<SuggestedReply | null> {
  const { message, context, apiKey, model } = params;
  const cleanKey = apiKey.trim();
  if (!cleanKey) return null;

  const system = [
    'You are Nexora Support AI for Spanish-speaking SaaS users.',
    'Return STRICT JSON only with keys: title, message, nextSteps, campaignDraft.',
    'nextSteps must be an array of concise Spanish action steps.',
    'campaignDraft is optional and must be null or an object with: name, objective, channel, budget, status, launchWindow, hook, promise, cta, angle, checklist.',
    'Use status exactly "draft" if campaignDraft exists.',
    'Never include markdown fences or explanations outside JSON.',
  ].join(' ');

  const userPrompt = JSON.stringify(
    {
      userMessage: message,
      context: {
        name: context.name || null,
        plan: context.plan || null,
        founderAccess: Boolean(context.founderAccess),
        adAccountsCount: context.adAccountsCount,
        activeCampaigns: context.activeCampaigns,
      },
      style: { language: 'es', tone: 'accionable, concreto, directo' },
      constraints: [
        'No inventes datos de facturacion que no esten en contexto.',
        'Prioriza pasos concretos dentro de Nexora.',
        'Si el usuario pide crear campaña, puedes devolver campaignDraft.',
      ],
    },
    null,
    2
  );

  // Rotar entre modelos gratuitos para garantizar disponibilidad permanente
  const modelsToTry = model
    ? [model]
    : [DEFAULT_OPENROUTER_MODEL, ...OPENROUTER_FALLBACK_MODELS.filter((m) => m !== DEFAULT_OPENROUTER_MODEL)];

  for (const targetModel of modelsToTry.slice(0, 3)) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cleanKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://www.gotnexora.com',
          'X-Title': 'Nexora Support AI',
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 900,
        }),
      });

      if (!response.ok) continue;

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const text = (payload.choices || [])
        .map((c) => c.message?.content || '')
        .join('\n')
        .trim();

      if (!text) continue;

      try {
        const parsed = JSON.parse(extractJsonObject(text));
        const result = safeReply(parsed);
        if (result) return result;
      } catch {
        continue;
      }
    } catch {
      continue;
    }
  }

  return null;
}
