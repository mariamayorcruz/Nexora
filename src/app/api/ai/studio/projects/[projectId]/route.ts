import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: { projectId: string } }) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.aiVideoProject.findFirst({
      where: {
        id: context.params.projectId,
        userId,
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 20,
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('AI project GET error:', error);
    return NextResponse.json({ error: 'No se pudo cargar el proyecto.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: { projectId: string } }) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      name?: string;
      prompt?: string;
      outputFormat?: string;
      captionStyle?: string;
      tool?: string;
      timeline?: unknown;
      status?: string;
    };

    const data: Prisma.AiVideoProjectUpdateInput = {};

    if (typeof body.name === 'string') data.name = body.name.trim() || 'Proyecto sin nombre';
    if (typeof body.prompt === 'string') data.prompt = body.prompt.trim();
    if (typeof body.outputFormat === 'string') data.outputFormat = body.outputFormat.trim();
    if (typeof body.captionStyle === 'string') data.captionStyle = body.captionStyle.trim();
    if (typeof body.tool === 'string') data.tool = body.tool.trim();
    if (typeof body.status === 'string') data.status = body.status.trim();

    if (body.timeline !== undefined) {
      data.timeline = JSON.parse(JSON.stringify(body.timeline)) as Prisma.InputJsonValue;
    }

    const existing = await prisma.aiVideoProject.findFirst({
      where: { id: context.params.projectId, userId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 });
    }

    const project = await prisma.aiVideoProject.update({
      where: { id: existing.id },
      data,
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error('AI project PATCH error:', error);
    return NextResponse.json({ error: 'No se pudo actualizar el proyecto.' }, { status: 500 });
  }
}
