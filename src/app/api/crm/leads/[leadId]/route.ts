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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
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
        stage: body.stage !== undefined ? body.stage?.trim() || 'lead' : undefined,
        value: body.value !== undefined ? Number(body.value || 0) : undefined,
        confidence:
          body.confidence !== undefined
            ? Math.min(100, Math.max(0, Number(body.confidence || 0)))
            : undefined,
        nextAction: body.nextAction !== undefined ? body.nextAction?.trim() || null : undefined,
        notes: body.notes !== undefined ? body.notes?.trim() || null : undefined,
        lastContactedAt:
          body.lastContactedAt !== undefined
            ? body.lastContactedAt
              ? new Date(body.lastContactedAt)
              : null
            : undefined,
      },
    });

    return NextResponse.json({ lead });
  } catch (error) {
    console.error('Error updating CRM lead:', error);
    return NextResponse.json({ error: 'Error updating CRM lead' }, { status: 500 });
  }
}
