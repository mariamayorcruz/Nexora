import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, context: { params: { projectId: string } }) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      note?: string;
      timeline?: unknown;
      renderPlan?: unknown;
    };

    const project = await prisma.aiVideoProject.findFirst({
      where: {
        id: context.params.projectId,
        userId,
      },
      select: {
        id: true,
        timeline: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 });
    }

    const timelineRaw = body.timeline ?? project.timeline;
    if (!timelineRaw) {
      return NextResponse.json({ error: 'El proyecto no tiene timeline para versionar.' }, { status: 400 });
    }

    const timeline = JSON.parse(JSON.stringify(timelineRaw)) as Prisma.InputJsonValue;
    const renderPlan = body.renderPlan
      ? (JSON.parse(JSON.stringify(body.renderPlan)) as Prisma.InputJsonValue)
      : undefined;

    const createdVersion = await prisma.$transaction(async (tx) => {
      const latest = await tx.aiVideoProjectVersion.findFirst({
        where: { projectId: context.params.projectId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const version = (latest?.version || 0) + 1;

      const item = await tx.aiVideoProjectVersion.create({
        data: {
          projectId: context.params.projectId,
          userId,
          version,
          note: typeof body.note === 'string' ? body.note.trim() : null,
          timeline,
          ...(renderPlan !== undefined ? { renderPlan } : {}),
        },
      });

      await tx.aiVideoProject.update({
        where: { id: context.params.projectId },
        data: {
          timeline,
          status: 'versioned',
        },
      });

      return item;
    });

    return NextResponse.json({ version: createdVersion }, { status: 201 });
  } catch (error) {
    console.error('AI project version POST error:', error);
    return NextResponse.json({ error: 'No se pudo crear la versión del proyecto.' }, { status: 500 });
  }
}
