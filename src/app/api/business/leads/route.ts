import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminEmail, isFounderEmail } from '@/lib/access';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

async function getAuthorizedUser(request: NextRequest) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const decoded = verifyUserToken(token);
  if (!decoded?.userId) {
    return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, email: true },
  });

  if (!user) {
    return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) };
  }

  return { user };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthorizedUser(request);
    if ('error' in auth) return auth.error;

    const privileged = isAdminEmail(auth.user.email) || isFounderEmail(auth.user.email);
    const captures = await prisma.leadCapture.findMany({
      where: privileged
        ? undefined
        : {
            OR: [{ userId: auth.user.id }, { email: auth.user.email }],
          },
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

    const privileged = isAdminEmail(auth.user.email) || isFounderEmail(auth.user.email);
    if (!privileged && capture.userId !== auth.user.id && capture.email !== auth.user.email) {
      return NextResponse.json({ error: 'No tienes permiso para mover este lead.' }, { status: 403 });
    }

    const existingLead = await prisma.crmLead.findFirst({
      where: {
        userId: auth.user.id,
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
