import { NextRequest, NextResponse } from 'next/server';
import { isInternalOrTestEmail } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { CRM_ALLOWED_STAGES } from '@/lib/sales-playbook';
import {
  crmReadErrorResponse,
  NEXORA_ORGANIZATION_HEADER,
  resolveCrmReadOrganization,
} from '@/lib/tenancy/resolve-crm-read-organization';
import {
  crmWriteErrorResponse,
  resolveCrmWriteOrganization,
} from '@/lib/tenancy/resolve-crm-write-organization';
import { omitCrmLeadOrganizationId } from '@/lib/tenancy/resolve-legacy-crm-write-organization';

export const dynamic = 'force-dynamic';

function toFiniteLeadValue(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function toClampedConfidenceForCreate(raw: unknown): number {
  if (raw === undefined || raw === null) {
    return 25;
  }
  const n = Number(raw);
  const base = Number.isFinite(n) ? n : 25;
  return Math.min(100, Math.max(0, Math.round(base)));
}

function toLastContactedAtOrNull(raw: unknown): Date | null {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  const d = new Date(raw as string | number | Date);
  return Number.isFinite(d.getTime()) ? d : null;
}

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

    // Point 8B-4: CrmLead reads authorize by organizationId only (no userId fallback).
    const rawLeads = await prisma.crmLead.findMany({
      where: { organizationId: readOrg.context.organizationId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
    const leads = rawLeads.filter((lead) => !isInternalOrTestEmail(lead.email));

    return NextResponse.json({
      leads: leads.map((lead) => {
        const publicLead = omitCrmLeadOrganizationId(lead);
        return {
          ...publicLead,
          stage: CRM_ALLOWED_STAGES.has(lead.stage) ? lead.stage : 'lead',
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching CRM leads:', error);
    return NextResponse.json({ error: 'Error fetching CRM leads' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorizationHeader = request.headers.get('authorization');
    const writeOrg = await resolveCrmWriteOrganization({
      authorizationHeader,
      organizationIdHeader: request.headers.get(NEXORA_ORGANIZATION_HEADER),
    });
    if (!writeOrg.ok) {
      return crmWriteErrorResponse(writeOrg);
    }

    const body = await request.json();
    const name = String(body.name || '').trim();
    const cleanEmail = body.email?.trim()?.toLowerCase() || null;

    if (!name) {
      return NextResponse.json({ error: 'El nombre del contacto es obligatorio.' }, { status: 400 });
    }
    if (cleanEmail && isInternalOrTestEmail(cleanEmail)) {
      return NextResponse.json(
        { error: 'Los correos internos o de prueba no se guardan en el CRM comercial.' },
        { status: 400 }
      );
    }

    // Point 8B-5B: ownership from TenantContext. Never trust body.organizationId.
    const lead = await prisma.crmLead.create({
      data: {
        userId: writeOrg.context.userId,
        organizationId: writeOrg.context.organizationId,
        name,
        email: cleanEmail,
        phone: body.phone?.trim() || null,
        company: body.company?.trim() || null,
        source: body.source?.trim() || 'manual',
        stage: CRM_ALLOWED_STAGES.has(String(body.stage || '').trim()) ? String(body.stage).trim() : 'lead',
        value: toFiniteLeadValue(body.value),
        confidence: toClampedConfidenceForCreate(body.confidence),
        nextAction: body.nextAction?.trim() || null,
        notes: body.notes?.trim() || null,
        lastContactedAt: toLastContactedAtOrNull(body.lastContactedAt),
      },
    });

    return NextResponse.json({ lead: omitCrmLeadOrganizationId(lead) });
  } catch (error) {
    console.error('Error creating CRM lead:', error);
    return NextResponse.json({ error: 'Error creating CRM lead' }, { status: 500 });
  }
}
