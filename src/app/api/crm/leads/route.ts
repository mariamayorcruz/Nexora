import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ALLOWED_STAGES = new Set(['lead', 'contacted', 'qualified', 'proposal', 'won']);

function getUserIdFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key') as { userId: string };
  return decoded.userId;
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
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
        stage: ALLOWED_STAGES.has(lead.stage) ? lead.stage : 'lead',
      })),
    });
  } catch (error) {
    console.error('Error fetching CRM leads:', error);
    return NextResponse.json({ error: 'Error fetching CRM leads' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
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
        stage: ALLOWED_STAGES.has(String(body.stage || '').trim()) ? String(body.stage).trim() : 'lead',
        value: Number(body.value || 0),
        confidence: Math.min(100, Math.max(0, Number(body.confidence || 25))),
        nextAction: body.nextAction?.trim() || null,
        notes: body.notes?.trim() || null,
        lastContactedAt: body.lastContactedAt ? new Date(body.lastContactedAt) : null,
      },
    });

    return NextResponse.json({ lead });
  } catch (error) {
    console.error('Error creating CRM lead:', error);
    return NextResponse.json({ error: 'Error creating CRM lead' }, { status: 500 });
  }
}
