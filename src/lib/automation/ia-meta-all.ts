// Llama a todas las IAs y elige la mejor respuesta
import { callClaudeForBudgeting } from './ia-meta-claude';
import { callGeminiForBudgeting } from './ia-meta-gemini';
import { callOpenRouterForBudgeting } from './ia-meta-openrouter';
import { callGrokForBudgeting } from './ia-meta-grok';

export async function analyzeCampaignsAndAllocateBudgetAll({ user, adAccounts, campaigns, maxMonthlyBudget }) {
  // 1. Preparar datos para IA
  const summary = {
    adAccounts: adAccounts.map((a) => ({ id: a.id, platform: a.platform, name: a.accountName })),
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      platform: c.adAccount?.platform,
      status: c.status,
      spend: c.analytics?.spend || 0,
      results: c.analytics?.results || 0,
      cpa: c.analytics?.cpa || null,
    })),
    maxMonthlyBudget,
  };

  // 2. Llamar a todas las IAs en paralelo
  const [claude, gemini, openrouter, grok] = await Promise.all([
    callClaudeForBudgeting(summary),
    callGeminiForBudgeting(summary),
    callOpenRouterForBudgeting(summary),
    callGrokForBudgeting(summary),
  ]);

  // 3. Elegir la mejor respuesta (ejemplo: menor CPA sugerido, más ventas, o mayoría)
  const all = [claude, gemini, openrouter, grok].filter(r => r && !r.error && r.actions && r.actions.length > 0);
  if (all.length === 0) return { error: 'Ninguna IA devolvió sugerencias válidas', raw: { claude, gemini, openrouter, grok } };

  // Ejemplo: elegir la IA que sugiere mayor ventas totales
  let best = all[0];
  let maxSales = 0;
  for (const result of all) {
    const ventas = result.actions.reduce((sum, a) => sum + (a.ventas || 0), 0);
    if (ventas > maxSales) {
      maxSales = ventas;
      best = result;
    }
  }
  return { ...best, source: best === claude ? 'claude' : best === gemini ? 'gemini' : best === openrouter ? 'openrouter' : 'grok' };
}
