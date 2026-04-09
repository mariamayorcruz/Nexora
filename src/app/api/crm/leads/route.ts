import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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

    return NextResponse.json({ leads });
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
        stage: body.stage?.trim() || 'lead',
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
