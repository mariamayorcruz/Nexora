/**
 * Asistente de ventas por WhatsApp.
 * Recibe el historial de la conversación y el catálogo del negocio y devuelve
 * una respuesta estructurada: qué contestar, cómo quedó el lead y qué hacer.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const AGENT_MODEL = process.env.SALES_AGENT_MODEL || 'claude-3-5-sonnet-20241022';

export type AgentAction = 'reply' | 'quote' | 'charge' | 'escalate';
export type LeadTemperature = 'hot' | 'warm' | 'cold';

export interface AgentProduct {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
}

export interface AgentTurn {
  role: 'customer' | 'business';
  content: string;
}

export interface AgentContext {
  businessName: string;
  tone: string;
  language: string;
  qualificationPrompt?: string | null;
  products: AgentProduct[];
  history: AgentTurn[];
  customerName?: string | null;
}

export interface AgentDecision {
  reply: string;
  temperature: LeadTemperature;
  action: AgentAction;
  productId?: string | null;
  reason?: string;
}

const ESCALATION_DEFAULTS = ['reclamo', 'abogado', 'demanda', 'hablar con alguien', 'persona real', 'humano'];

export function needsHumanEscalation(text: string, extraKeywords?: string | null): boolean {
  const haystack = text.toLowerCase();
  const extras = (extraKeywords || '')
    .split(',')
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);
  return [...ESCALATION_DEFAULTS, ...extras].some((word) => haystack.includes(word));
}

function buildSystemPrompt(context: AgentContext): string {
  const catalog = context.products.length
    ? context.products
        .map((p) => `- ${p.name} (id: ${p.id}) · ${p.price} ${p.currency}${p.description ? ` · ${p.description}` : ''}`)
        .join('\n')
    : '- (sin catálogo cargado)';

  return [
    `Eres el asistente de ventas por WhatsApp de "${context.businessName}".`,
    `Hablas en ${context.language === 'pt' ? 'portugués' : context.language === 'en' ? 'inglés' : 'español latinoamericano'}, en tono ${context.tone}.`,
    'Reglas:',
    '- Mensajes cortos, naturales, de WhatsApp. Máximo 3 frases.',
    '- Nunca inventes precios, plazos ni productos: usa solo el catálogo.',
    '- Si el cliente quiere comprar, usa la acción "charge" e indica el productId exacto.',
    '- Si pide hablar con una persona o hay un reclamo, usa "escalate".',
    '- No pidas datos sensibles (tarjetas, claves). El cobro va siempre por link.',
    context.qualificationPrompt ? `Preguntas de calificación del negocio: ${context.qualificationPrompt}` : '',
    'Catálogo:',
    catalog,
    'Responde SIEMPRE en JSON válido con esta forma exacta:',
    '{"reply":"texto","temperature":"hot|warm|cold","action":"reply|quote|charge|escalate","productId":"id o null"}',
  ]
    .filter(Boolean)
    .join('\n');
}

function fallbackDecision(context: AgentContext): AgentDecision {
  const last = context.history.filter((turn) => turn.role === 'customer').slice(-1)[0]?.content || '';
  if (needsHumanEscalation(last)) {
    return {
      reply: 'Claro, te paso con una persona del equipo ahora mismo. 🙌',
      temperature: 'warm',
      action: 'escalate',
      reason: 'palabra clave de escalamiento',
    };
  }
  return {
    reply: `¡Hola${context.customerName ? ` ${context.customerName}` : ''}! Soy el asistente de ${context.businessName}. ¿En qué te puedo ayudar?`,
    temperature: 'warm',
    action: 'reply',
    reason: 'sin modelo de IA configurado',
  };
}

function parseDecision(raw: string, context: AgentContext): AgentDecision {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return fallbackDecision(context);
  try {
    const parsed = JSON.parse(match[0]) as Partial<AgentDecision>;
    const action: AgentAction =
      parsed.action === 'charge' || parsed.action === 'quote' || parsed.action === 'escalate' ? parsed.action : 'reply';
    const temperature: LeadTemperature =
      parsed.temperature === 'hot' || parsed.temperature === 'cold' ? parsed.temperature : 'warm';
    return {
      reply: String(parsed.reply || '').trim() || fallbackDecision(context).reply,
      temperature,
      action,
      productId: parsed.productId || null,
    };
  } catch {
    return fallbackDecision(context);
  }
}

export async function runSalesAgent(context: AgentContext): Promise<AgentDecision> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackDecision(context);

  const messages = context.history.slice(-20).map((turn) => ({
    role: turn.role === 'customer' ? ('user' as const) : ('assistant' as const),
    content: turn.content,
  }));
  if (!messages.length) return fallbackDecision(context);

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AGENT_MODEL,
        max_tokens: 500,
        system: buildSystemPrompt(context),
        messages,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[sales-agent] respuesta ${response.status}: ${body}`);
      return fallbackDecision(context);
    }

    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.map((part) => part.text || '').join('') || '';
    return parseDecision(text, context);
  } catch (error) {
    console.error('[sales-agent] error llamando al modelo', error);
    return fallbackDecision(context);
  }
}
