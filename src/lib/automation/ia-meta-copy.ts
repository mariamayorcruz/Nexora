// Llama a Claude para generar copies y sugerir ubicaciones
import { getClaudeApiKey } from '@/lib/admin-config';

export async function callClaudeForAdCopyAndPlacement({ business, campaignGoal, budget, platform }) {
  const apiKey = await getClaudeApiKey();
  if (!apiKey) return { error: 'Claude API key missing' };

  const prompt = `
Eres un copywriter y media buyer experto en Meta Ads. Genera 2 variantes de copy para una campaña cuyo objetivo es "${campaignGoal}" para el siguiente negocio:

${business}

Presupuesto diario: ${budget} USD
Plataforma: ${platform}

Sugiere también las mejores ubicaciones (placements) para publicar el anuncio (ej: Feed, Stories, Reels, Audience Network, etc.) según el objetivo y el tipo de negocio. Devuelve un JSON con el formato:
{
  "copies": ["...", "..."],
  "placements": ["Feed", "Stories", ...]
}
`;

  const response = await fetch('https://api.openrouter.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3-sonnet',
      messages: [
        { role: 'system', content: 'Eres un media buyer IA.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 800,
      temperature: 0.4,
    }),
  });

  const data = await response.json();
  try {
    const text = data.choices?.[0]?.message?.content || '';
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const result = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
      return result;
    }
  } catch {}
  return { error: 'No se pudo interpretar la respuesta de Claude', raw: data };
}
