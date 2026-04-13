import { NextRequest, NextResponse } from 'next/server';
import { getClaudeApiKey } from '@/lib/admin-config';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

type AssistTask = 'improve-primary' | 'headline' | 'cta';

function parseSuggestionJson(raw: string): string | null {
  const text = raw.trim();
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) return null;
  try {
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { suggestion?: string };
    const s = String(parsed.suggestion || '').trim();
    return s || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      task?: string;
      campaignName?: string;
      description?: string;
      primaryText?: string;
      headline?: string;
      cta?: string;
      channelLabel?: string;
      businessType?: string;
    };

    const task = String(body.task || '').trim() as AssistTask;
    const allowed: AssistTask[] = ['improve-primary', 'headline', 'cta'];
    if (!allowed.includes(task)) {
      return NextResponse.json({ error: 'Tarea no válida.' }, { status: 400 });
    }

    const apiKey = await getClaudeApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'IA no configurada. Contacta al administrador o revisa la clave de API.' },
        { status: 503 }
      );
    }

    const campaignName = String(body.campaignName || '').trim() || '(sin nombre)';
    const description = String(body.description || '').trim();
    const primaryText = String(body.primaryText || '').trim();
    const headline = String(body.headline || '').trim();
    const cta = String(body.cta || '').trim();
    const channelLabel = String(body.channelLabel || 'paid social').trim();
    const businessType = String(body.businessType || '').trim();

    const contextBlock = [
      `Campaña: ${campaignName}`,
      `Canal: ${channelLabel}`,
      businessType ? `Tipo de negocio (si aplica): ${businessType}` : null,
      description ? `Descripción / contexto: ${description}` : null,
      headline ? `Titular actual: ${headline}` : null,
      primaryText ? `Texto principal actual: ${primaryText}` : null,
      cta ? `CTA actual: ${cta}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    let instruction: string;
    if (task === 'improve-primary') {
      instruction = `Mejora el TEXTO PRINCIPAL del anuncio (español). Mantén la intención y el tono; hazlo más claro y persuasivo para conversión. Máximo ~280 caracteres. Si el texto actual está vacío, redacta uno nuevo acorde al contexto.`;
    } else if (task === 'headline') {
      instruction = `Genera un TITULAR corto para el anuncio (español), máximo ~60 caracteres, impactante y claro. Si ya hay titular, mejóralo o ofrece una alternativa mejor.`;
    } else {
      instruction = `Sugiere un texto de BOTÓN CTA corto (español), 2–4 palabras típicas de anuncios (ej. "Ver más", "Probar gratis"). Una sola variante, sin comillas extra.`;
    }

    const userPrompt = `${contextBlock}\n\n${instruction}\n\nResponde SOLO con un JSON válido, sin markdown, con esta forma exacta: {"suggestion":"..."}`;

    const response = await fetch('https://api.openrouter.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages: [
          {
            role: 'system',
            content:
              'Eres un copywriter experto en anuncios digitales en español. Cumples el formato JSON pedido sin texto adicional.',
          },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.45,
      }),
    });

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
    if (!response.ok) {
      const err = data.error?.message || 'Error del proveedor IA';
      return NextResponse.json({ error: err }, { status: 502 });
    }

    const content = data.choices?.[0]?.message?.content || '';
    const suggestion = parseSuggestionJson(content);
    if (!suggestion) {
      return NextResponse.json({ error: 'No se pudo interpretar la sugerencia. Intenta de nuevo.' }, { status: 422 });
    }

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error('campaign-copy-assist error:', error);
    return NextResponse.json({ error: 'Error al generar texto' }, { status: 500 });
  }
}
