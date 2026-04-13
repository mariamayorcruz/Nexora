import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import { CRM_ALLOWED_STAGES } from '@/lib/sales-playbook';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!getBearerToken(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = getUserIdFromAuthorizationHeader(authHeader);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const leads = await prisma.crmLead.findMany({
      where: { userId },
      select: { stage: true, value: true },
    });

    const byStage: Record<string, { count: number; value: number }> = {};
    let totalPipelineValue = 0;
    let wonValue = 0;

    for (const lead of leads) {
      const normalizedStage = CRM_ALLOWED_STAGES.has(lead.stage) ? lead.stage : 'lead';
      if (!byStage[normalizedStage]) byStage[normalizedStage] = { count: 0, value: 0 };
      byStage[normalizedStage].count += 1;
      byStage[normalizedStage].value += lead.value;
      if (normalizedStage !== 'won') {
        totalPipelineValue += lead.value;
      }
      if (normalizedStage === 'won') {
        wonValue += lead.value;
      }
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
