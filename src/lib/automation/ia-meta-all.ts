import { callClaudeForBudgeting } from './ia-meta-claude';

type BudgetSummary = {
  adAccounts: Array<{ id: string; platform: string; name: string }>;
  campaigns: Array<{
    id: string;
    name: string;
    platform: string | undefined;
    status: string;
    spend: number;
    results: number;
    cpa: number | null;
  }>;
  maxMonthlyBudget: number;
};

export async function analyzeCampaignsAndAllocateBudgetAll({
  adAccounts,
  campaigns,
  maxMonthlyBudget,
}: BudgetSummary) {
  return callClaudeForBudgeting({
    adAccounts,
    campaigns,
    maxMonthlyBudget,
  });
}
