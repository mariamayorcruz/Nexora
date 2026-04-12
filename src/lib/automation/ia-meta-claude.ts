// Llama a Claude para decidir asignación de presupuesto y acciones
import { getClaudeApiKey } from '@/lib/admin-config';

export async function callClaudeForBudgeting(summary: any) {
  const apiKey = await getClaudeApiKey();
  if (!apiKey) return { error: 'Claude API key missing' };

  // Ejemplo de prompt para Claude
  const prompt = `
Eres un media buyer experto. Analiza las campañas activas y distribuye el presupuesto mensual (${summary.maxMonthlyBudget} USD) entre las campañas y plataformas donde el CPA sea menor y las ventas sean mayores. Sugiere acciones: aumentar presupuesto, pausar campañas, mover inversión entre plataformas. Devuelve un JSON con las acciones recomendadas.

Datos:
${JSON.stringify(summary, null, 2)}

Formato de respuesta:
{
  "actions": [
    { "campaignId": "...", "action": "increase_budget|pause|move_budget", "amount": 123, "reason": "..." }
  ]
}
`;

  // Llamada a Claude (OpenRouter, Anthropic, etc.)
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
      temperature: 0.2,
    }),
  });

  const data = await response.json();
  // Extraer acciones del output de Claude
  try {
    const text = data.choices?.[0]?.message?.content || '';
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const actions = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
      return actions;
    }
  } catch {}
  return { error: 'No se pudo interpretar la respuesta de Claude', raw: data };
}
