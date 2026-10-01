import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CRM_ALLOWED_STAGES } from '@/lib/sales-playbook';
import {
  crmWriteErrorResponse,
  NEXORA_ORGANIZATION_HEADER,
  resolveCrmWriteOrganization,
} from '@/lib/tenancy/resolve-crm-write-organization';
import { omitCrmLeadOrganizationId } from '@/lib/tenancy/resolve-legacy-crm-write-organization';

export const dynamic = 'force-dynamic';

function toFiniteLeadValue(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function toClampedConfidenceForPatch(raw: unknown): number {
  const n = Number(raw);
  const base = Number.isFinite(n) ? n : 0;
  return Math.min(100, Math.max(0, Math.round(base)));
}

function toLastContactedAtOrNull(raw: unknown): Date | null {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  const d = new Date(raw as string | number | Date);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
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

    if (body.stage !== undefined) {
      const trimmedStage = String(body.stage || '').trim();
      if (!CRM_ALLOWED_STAGES.has(trimmedStage)) {
        return NextResponse.json({ error: 'La etapa del lead no es válida.' }, { status: 400 });
      }
    }

    // Point 8B-5B: tenant-scoped by organizationId. Do NOT filter by creator userId.
    // Do NOT set organizationId in data.
    const existing = await prisma.crmLead.findFirst({
      where: { id: params.leadId, organizationId: writeOrg.context.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Lead no encontrado.' }, { status: 404 });
    }

    const lead = await prisma.crmLead.update({
      where: { id: existing.id, organizationId: writeOrg.context.organizationId },
      data: {
        name: body.name !== undefined ? String(body.name).trim() : undefined,
        email: body.email !== undefined ? body.email?.trim() || null : undefined,
        phone: body.phone !== undefined ? body.phone?.trim() || null : undefined,
        company: body.company !== undefined ? body.company?.trim() || null : undefined,
        source: body.source !== undefined ? body.source?.trim() || 'manual' : undefined,
        stage:
          body.stage !== undefined ? String(body.stage || '').trim() : undefined,
        value: body.value !== undefined ? toFiniteLeadValue(body.value) : undefined,
        confidence:
          body.confidence !== undefined ? toClampedConfidenceForPatch(body.confidence) : undefined,
        nextAction: body.nextAction !== undefined ? body.nextAction?.trim() || null : undefined,
        notes: body.notes !== undefined ? body.notes?.trim() || null : undefined,
        lastContactedAt:
          body.lastContactedAt !== undefined ? toLastContactedAtOrNull(body.lastContactedAt) : undefined,
      },
    });

    return NextResponse.json({ lead: omitCrmLeadOrganizationId(lead) });
  } catch (error) {
    console.error('Error updating CRM lead:', error);
    return NextResponse.json({ error: 'Error updating CRM lead' }, { status: 500 });
  }
}
