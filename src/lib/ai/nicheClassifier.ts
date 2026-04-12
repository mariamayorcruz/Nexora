export interface BusinessProfile {
  url?: string;
  description: string;
  productType: 'saas' | 'ecommerce' | 'infoproduct' | 'services' | 'app';
  pricePoint: 'low' | 'medium' | 'high';
  targetAge: '18-24' | '25-34' | '35-44' | '45+';
  b2b: boolean;
}

export interface PlatformRecommendation {
  platform: 'meta' | 'google' | 'tiktok' | 'linkedin';
  score: number;
  reasoning: string;
  suggestedBudgetSplit: number;
  expectedCpa: number;
  creativeStrategy: 'video-viral' | 'search-intent' | 'professional' | 'impulse-buy';
}

function pushOrMerge(
  list: PlatformRecommendation[],
  item: PlatformRecommendation
): PlatformRecommendation[] {
  const existing = list.find((entry) => entry.platform === item.platform);
  if (!existing) {
    return [...list, item];
  }

  return list.map((entry) =>
    entry.platform === item.platform
      ? {
          ...entry,
          score: Math.max(entry.score, item.score),
          reasoning: `${entry.reasoning} ${item.reasoning}`.trim(),
          expectedCpa: Math.round((entry.expectedCpa + item.expectedCpa) / 2),
          creativeStrategy: item.score > entry.score ? item.creativeStrategy : entry.creativeStrategy,
        }
      : entry
  );
}

function normalizeSplit(list: PlatformRecommendation[]) {
  const totalScore = list.reduce((sum, entry) => sum + entry.score, 0) || 1;
  return list
    .sort((a, b) => b.score - a.score)
    .map((entry) => ({
      ...entry,
      suggestedBudgetSplit: Math.round((entry.score / totalScore) * 100),
    }));
}

export async function analyzeNiche(
  profile: BusinessProfile
): Promise<PlatformRecommendation[]> {
  let recommendations: PlatformRecommendation[] = [];

  if (profile.b2b || profile.pricePoint === 'high') {
    recommendations = pushOrMerge(recommendations, {
      platform: 'linkedin',
      score: 85,
      reasoning: 'B2B y high-ticket suelen responder mejor en contexto profesional.',
      suggestedBudgetSplit: 40,
      expectedCpa: profile.pricePoint === 'high' ? 80 : 45,
      creativeStrategy: 'professional',
    });

    recommendations = pushOrMerge(recommendations, {
      platform: 'google',
      score: 76,
      reasoning: 'La demanda activa por busqueda acelera pruebas en tickets altos.',
      suggestedBudgetSplit: 30,
      expectedCpa: 58,
      creativeStrategy: 'search-intent',
    });
  }

  if (!profile.b2b && profile.targetAge === '18-24') {
    recommendations = pushOrMerge(recommendations, {
      platform: 'tiktok',
      score: 90,
      reasoning: 'Audiencia joven con alto consumo de video corto.',
      suggestedBudgetSplit: 50,
      expectedCpa: 24,
      creativeStrategy: 'video-viral',
    });
  }

  if (profile.productType === 'ecommerce' && profile.pricePoint === 'low') {
    recommendations = pushOrMerge(recommendations, {
      platform: 'meta',
      score: 83,
      reasoning: 'Compra impulsiva y remarketing suelen escalar mas rapido en Meta.',
      suggestedBudgetSplit: 60,
      expectedCpa: 30,
      creativeStrategy: 'impulse-buy',
    });
  }

  if (profile.productType === 'saas' || profile.productType === 'services') {
    recommendations = pushOrMerge(recommendations, {
      platform: 'meta',
      score: 72,
      reasoning: 'Meta ayuda a capturar demanda latente para demos y diagnosticos.',
      suggestedBudgetSplit: 35,
      expectedCpa: 42,
      creativeStrategy: profile.b2b ? 'professional' : 'video-viral',
    });
  }

  if (recommendations.length === 0) {
    recommendations = [
      {
        platform: 'meta',
        score: 70,
        reasoning: 'Canal base para validar narrativa y creatividades rapidamente.',
        suggestedBudgetSplit: 50,
        expectedCpa: 38,
        creativeStrategy: 'video-viral',
      },
      {
        platform: 'google',
        score: 65,
        reasoning: 'Canal base para capturar intencion y medir calidad de lead.',
        suggestedBudgetSplit: 50,
        expectedCpa: 44,
        creativeStrategy: 'search-intent',
      },
    ];
  }

  return normalizeSplit(recommendations);
}
