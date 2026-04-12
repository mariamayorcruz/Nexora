// Lógica IA: analizar campañas y decidir asignación de presupuesto
import { callClaudeForBudgeting } from './ia-meta-claude';

export async function analyzeCampaignsAndAllocateBudget({ user, adAccounts, campaigns, maxMonthlyBudget }: any) {
  // 1. Preparar datos para IA
  const summary = {
    adAccounts: adAccounts.map((a: any) => ({ id: a.id, platform: a.platform, name: a.accountName })),
    campaigns: campaigns.map((c: any) => ({
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

  // 2. Llamar a Claude para decidir asignación
  const iaResult = await callClaudeForBudgeting(summary);

  // 3. Devolver acciones sugeridas
  return iaResult;
}
