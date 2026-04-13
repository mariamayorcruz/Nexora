import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import { CRM_ALLOWED_STAGES } from '@/lib/sales-playbook';

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
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (body.stage !== undefined) {
      const trimmedStage = String(body.stage || '').trim();
      if (!CRM_ALLOWED_STAGES.has(trimmedStage)) {
        return NextResponse.json({ error: 'La etapa del lead no es válida.' }, { status: 400 });
      }
    }

    const existing = await prisma.crmLead.findFirst({
      where: { id: params.leadId, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Lead no encontrado.' }, { status: 404 });
    }

    const lead = await prisma.crmLead.update({
      where: { id: params.leadId },
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

    return NextResponse.json({ lead });
  } catch (error) {
    console.error('Error updating CRM lead:', error);
    return NextResponse.json({ error: 'Error updating CRM lead' }, { status: 500 });
  }
}
