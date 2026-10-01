import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CRM_ALLOWED_STAGES } from '@/lib/sales-playbook';
import {
  crmReadErrorResponse,
  NEXORA_ORGANIZATION_HEADER,
  resolveCrmReadOrganization,
} from '@/lib/tenancy/resolve-crm-read-organization';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authorizationHeader = request.headers.get('authorization');
    const readOrg = await resolveCrmReadOrganization({
      authorizationHeader,
      organizationIdHeader: request.headers.get(NEXORA_ORGANIZATION_HEADER),
    });
    if (!readOrg.ok) {
      return crmReadErrorResponse(readOrg);
    }

    // Point 8B-4: CRM stats authorize by organizationId only.
    const leads = await prisma.crmLead.findMany({
      where: { organizationId: readOrg.context.organizationId },
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
