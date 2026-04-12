import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = verifyUserToken(token);
  if (!decoded?.userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const leads = await prisma.crmLead.findMany({
      where: { userId: decoded.userId },
      select: { stage: true, value: true },
    });

    const byStage: Record<string, { count: number; value: number }> = {};
    let totalPipelineValue = 0;
    let wonValue = 0;

    for (const lead of leads) {
      const stage = lead.stage || 'lead';
      if (!byStage[stage]) byStage[stage] = { count: 0, value: 0 };
      byStage[stage].count += 1;
      byStage[stage].value += lead.value;
      totalPipelineValue += lead.value;
      if (stage === 'won') wonValue += lead.value;
    }

    return NextResponse.json({
      totalLeads: leads.length,
      totalPipelineValue,
      wonValue,
      byStage,
    });
  } catch (error) {
    console.error('Error fetching CRM stats:', error);
    return NextResponse.json({ error: 'Error fetching CRM stats' }, { status: 500 });
  }
}
