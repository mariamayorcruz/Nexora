import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';
import { buildRenderPlan } from '@/lib/video-pipeline';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

function ensureUser(request: NextRequest) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) return null;
  const decoded = verifyUserToken(token);
  return decoded?.userId || null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = ensureUser(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projects = await prisma.aiVideoProject.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { id: true, version: true, createdAt: true, note: true },
        },
      },
    });

    return NextResponse.json({
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        tool: project.tool,
        prompt: project.prompt,
        outputFormat: project.outputFormat,
        captionStyle: project.captionStyle,
        status: project.status,
        timeline: project.timeline,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        latestVersion: project.versions[0] || null,
      })),
    });
  } catch (error) {
    console.error('AI projects GET error:', error);
    return NextResponse.json({ error: 'No se pudieron cargar los proyectos.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = ensureUser(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      name?: string;
      tool?: string;
      prompt?: string;
      outputFormat?: string;
      captionStyle?: string;
      assetUrls?: string[];
    };

    const name = String(body.name || 'Nuevo proyecto').trim();
    const tool = String(body.tool || 'text-to-video');
    const prompt = String(body.prompt || '').trim();
    const outputFormat = String(body.outputFormat || 'vertical 9:16');
    const captionStyle = String(body.captionStyle || 'bold clean');
    const assetUrls = Array.isArray(body.assetUrls) ? body.assetUrls.filter((url) => typeof url === 'string').slice(0, 8) : [];

    if (!prompt) {
      return NextResponse.json({ error: 'El brief es obligatorio para crear un proyecto.' }, { status: 400 });
    }

    const initialPlan = buildRenderPlan({
      prompt,
      outputFormat,
      captionStyle,
      assetUrls,
    });

    const timeline = JSON.parse(JSON.stringify(initialPlan.scenes)) as Prisma.InputJsonValue;
    const renderPlan = JSON.parse(JSON.stringify(initialPlan)) as Prisma.InputJsonValue;

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.aiVideoProject.create({
        data: {
          userId,
          name,
          tool,
          prompt,
          outputFormat,
          captionStyle,
          timeline,
        },
      });

      await tx.aiVideoProjectVersion.create({
        data: {
          projectId: created.id,
          userId,
          version: 1,
          note: 'Versión inicial',
          timeline,
          renderPlan,
        },
      });

      return created;
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('AI projects POST error:', error);
    return NextResponse.json({ error: 'No se pudo crear el proyecto.' }, { status: 500 });
  }
}
