import { NextRequest, NextResponse } from 'next/server';
import { analyzeNiche, type BusinessProfile } from '@/lib/ai/nicheClassifier';
import { optimizeBudget } from '@/lib/ai/budgetOptimizer';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

function ensureAuth(request: NextRequest) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) return null;
  const decoded = verifyUserToken(token);
  return decoded?.userId || null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = ensureAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as Partial<BusinessProfile> & { budget?: number };

    if (!body.description?.trim()) {
      return NextResponse.json({ error: 'La descripcion del negocio es obligatoria.' }, { status: 400 });
    }

    const profile: BusinessProfile = {
      description: body.description.trim(),
      productType: body.productType || 'services',
      pricePoint: body.pricePoint || 'medium',
      targetAge: body.targetAge || '25-34',
      b2b: Boolean(body.b2b),
      url: body.url || undefined,
    };

    const recommendations = await analyzeNiche(profile);
    const allocations = optimizeBudget(Number(body.budget) || 100, recommendations, 'learning');

    return NextResponse.json({
      profile,
      recommendations,
      allocations,
      totalEstimatedReach: Math.round((Number(body.budget) || 100) * 190),
    });
  } catch (error) {
    console.error('Smart analyze error:', error);
    return NextResponse.json({ error: 'No se pudo analizar el nicho.' }, { status: 500 });
  }
}
