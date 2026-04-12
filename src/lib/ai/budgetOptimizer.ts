import type { PlatformRecommendation } from '@/lib/ai/nicheClassifier';

export interface BudgetAllocation {
  platform: PlatformRecommendation['platform'];
  dailyBudget: number;
  bidStrategy: 'lowest_cost' | 'cost_cap' | 'bid_cap';
  optimizationGoal: 'THRUPLAY' | 'LINK_CLICKS' | 'LEAD' | 'PURCHASE';
}

export function optimizeBudget(
  totalDaily: number,
  recommendations: PlatformRecommendation[],
  phase: 'learning' | 'scaling' | 'mature' = 'learning'
): BudgetAllocation[] {
  const budget = Math.max(20, totalDaily);
  const top = recommendations.slice(0, 3);
  const totalScore = top.reduce((sum, item) => sum + item.score, 0) || 1;

  return top.map((item) => {
    const weight = item.score / totalScore;
    const phaseBoost = phase === 'scaling' ? 1.1 : phase === 'mature' ? 0.95 : 1;
    const dailyBudget = Math.round(weight * budget * phaseBoost * 100) / 100;

    const optimizationGoal =
      item.creativeStrategy === 'video-viral'
        ? 'THRUPLAY'
        : item.creativeStrategy === 'search-intent'
        ? 'LEAD'
        : item.creativeStrategy === 'impulse-buy'
        ? 'PURCHASE'
        : 'LINK_CLICKS';

    return {
      platform: item.platform,
      dailyBudget,
      bidStrategy: item.platform === 'google' ? 'cost_cap' : 'lowest_cost',
      optimizationGoal,
    };
  });
}
