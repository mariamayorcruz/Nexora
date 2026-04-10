import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { isAdminEmail, isFounderEmail } from '@/lib/access';

export const dynamic = 'force-dynamic';

async function getAuthorizedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key') as { userId: string };
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, email: true },
  });

  if (!user) {
    return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) };
  }

  if (!isAdminEmail(user.email) && !isFounderEmail(user.email)) {
    return { error: NextResponse.json({ error: 'Access denied' }, { status: 403 }) };
  }

  return { user };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthorizedUser(request);
    if ('error' in auth) return auth.error;

    const captures = await prisma.leadCapture.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      captures,
      summary: {
        total: captures.length,
        unconverted: captures.filter((capture) => !capture.convertedToCrmAt).length,
        masterclass: captures.filter((capture) => capture.source === 'masterclass').length,
      },
    });
  } catch (error) {
    console.error('Error fetching business leads:', error);
    return NextResponse.json({ error: 'Error fetching business leads' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthorizedUser(request);
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const captureId = String(body.captureId || '').trim();
    if (!captureId) {
      return NextResponse.json({ error: 'Lead capture requerido.' }, { status: 400 });
    }

    const capture = await prisma.leadCapture.findUnique({
      where: { id: captureId },
    });

    if (!capture) {
      return NextResponse.json({ error: 'Lead no encontrado.' }, { status: 404 });
    }

    const existingLead = await prisma.crmLead.findFirst({
      where: {
        OR: [{ email: capture.email }, { id: capture.crmLeadId || undefined }],
      },
    });

    const crmLead =
      existingLead ||
      (await prisma.crmLead.create({
        data: {
          userId: auth.user.id,
          name: capture.name || capture.email.split('@')[0],
          email: capture.email,
          source: capture.source,
          stage: 'lead',
          value: 0,
          confidence: 30,
          nextAction: 'Contactar y validar interés real',
          notes: `Lead captado desde ${capture.source}. Recurso solicitado: ${capture.resource}.`,
        },
      }));

    await prisma.leadCapture.update({
      where: { id: capture.id },
      data: {
        crmLeadId: crmLead.id,
        convertedToCrmAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, crmLead });
  } catch (error) {
    console.error('Error promoting business lead:', error);
    return NextResponse.json({ error: 'Error promoting business lead' }, { status: 500 });
  }
}
