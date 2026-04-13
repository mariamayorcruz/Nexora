import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import { CRM_ALLOWED_STAGES } from '@/lib/sales-playbook';

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
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leads = await prisma.crmLead.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({
      leads: leads.map((lead) => ({
        ...lead,
        stage: CRM_ALLOWED_STAGES.has(lead.stage) ? lead.stage : 'lead',
      })),
    });
  } catch (error) {
    console.error('Error fetching CRM leads:', error);
    return NextResponse.json({ error: 'Error fetching CRM leads' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name || '').trim();

    if (!name) {
      return NextResponse.json({ error: 'El nombre del contacto es obligatorio.' }, { status: 400 });
    }

    const lead = await prisma.crmLead.create({
      data: {
        userId,
        name,
        email: body.email?.trim() || null,
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

    return NextResponse.json({ lead });
  } catch (error) {
    console.error('Error creating CRM lead:', error);
    return NextResponse.json({ error: 'Error creating CRM lead' }, { status: 500 });
  }
}
