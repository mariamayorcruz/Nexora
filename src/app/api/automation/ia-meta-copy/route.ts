import { callClaudeForAdCopyAndPlacement } from '@/lib/automation/ia-meta-copy';
import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

// Endpoint para generar copies y ubicaciones sugeridas IA
export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request.headers.get('authorization'));
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const decoded = verifyUserToken(token);
    if (!decoded?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { business, campaignGoal, budget, platform } = await request.json();
    if (!business || !campaignGoal || !budget || !platform) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const result = await callClaudeForAdCopyAndPlacement({ business, campaignGoal, budget, platform });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Error generando copy IA' }, { status: 500 });
  }
}
