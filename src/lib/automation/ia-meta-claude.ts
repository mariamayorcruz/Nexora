// Integración con Claude deshabilitada temporalmente por falta de API key
export async function callClaudeForBudgeting(_summary: any) {
  return { error: 'Claude integration is disabled: no API key' };
}
