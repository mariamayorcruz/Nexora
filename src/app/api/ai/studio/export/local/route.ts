import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface TimelineScene {
  id: string;
  text: string;
  durationSec: number;
  assetUrl?: string;
}

function hasFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  return result.status === 0;
}

function normalizeTimeline(input: unknown): TimelineScene[] {
  if (!Array.isArray(input)) return [];

  const scenes: TimelineScene[] = [];

  input.forEach((scene, index) => {
    if (!scene || typeof scene !== 'object') return;

    const value = scene as Record<string, unknown>;
    const duration = Number(value.durationSec || 3);
    scenes.push({
      id: typeof value.id === 'string' ? value.id : `scene-${index + 1}`,
      text: typeof value.text === 'string' ? value.text : `Scene ${index + 1}`,
      durationSec: Number.isFinite(duration) && duration > 0 ? duration : 3,
      assetUrl: typeof value.assetUrl === 'string' ? value.assetUrl : undefined,
    });
  });

  return scenes;
}

function fileListPathValue(filePath: string) {
  return filePath.replaceAll('\\', '/').replace(/'/g, "'\\''");
}

async function downloadAsset(url: string, outputPath: string, origin: string) {
  const resolvedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : new URL(url, origin).toString();
  const response = await fetch(resolvedUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`No se pudo descargar asset: ${resolvedUrl}`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, data);
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      projectId?: string;
      timeline?: unknown;
      outputName?: string;
      format?: 'vertical 9:16' | 'horizontal 16:9' | 'square 1:1';
    };

    let timeline = normalizeTimeline(body.timeline);

    if (timeline.length === 0 && body.projectId) {
      const project = await prisma.aiVideoProject.findFirst({
        where: {
          id: String(body.projectId),
          userId,
        },
        select: { timeline: true },
      });

      timeline = normalizeTimeline(project?.timeline);
    }

    const scenesWithAssets = timeline.filter((scene) => Boolean(scene.assetUrl));

    if (scenesWithAssets.length === 0) {
      return NextResponse.json(
        {
          error: 'Necesitas al menos un clip en el timeline para exportar local.',
        },
        { status: 400 }
      );
    }

    const ffmpegReady = hasFfmpeg();
    const jobId = crypto.randomUUID();
    const renderRoot = path.join(process.cwd(), 'public', 'renders', userId, jobId);
    await mkdir(renderRoot, { recursive: true });

    if (!ffmpegReady) {
      const sampleCommand = 'ffmpeg -y -f concat -safe 0 -i concat.txt -c:v libx264 -pix_fmt yuv420p output.mp4';
      return NextResponse.json({
        mode: 'instructions',
        jobId,
        message: 'FFmpeg no está instalado en este entorno. Instálalo localmente y vuelve a ejecutar la exportación.',
        sampleCommand,
      });
    }

    const normalizedClipPaths: string[] = [];

    for (let i = 0; i < scenesWithAssets.length; i += 1) {
      const scene = scenesWithAssets[i];
      const rawInput = path.join(renderRoot, `clip-${i + 1}.mp4`);
      const normalized = path.join(renderRoot, `norm-${i + 1}.mp4`);

      await downloadAsset(String(scene.assetUrl), rawInput, request.nextUrl.origin);

      const scale =
        body.format === 'horizontal 16:9'
          ? 'scale=1920:1080:force_original_aspect_ratio=cover,crop=1920:1080'
          : body.format === 'square 1:1'
            ? 'scale=1080:1080:force_original_aspect_ratio=cover,crop=1080:1080'
            : 'scale=1080:1920:force_original_aspect_ratio=cover,crop=1080:1920';

      const normalizeResult = spawnSync(
        'ffmpeg',
        ['-y', '-i', rawInput, '-t', String(scene.durationSec), '-vf', scale, '-an', normalized],
        { encoding: 'utf-8' }
      );

      if (normalizeResult.status !== 0) {
        throw new Error(normalizeResult.stderr || 'FFmpeg falló normalizando un clip.');
      }

      normalizedClipPaths.push(normalized);
    }

    const concatFile = path.join(renderRoot, 'concat.txt');
    const concatBody = normalizedClipPaths.map((clipPath) => `file '${fileListPathValue(clipPath)}'`).join('\n');
    await writeFile(concatFile, concatBody, 'utf-8');

    const outputName = (body.outputName || 'video-final').replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 40) || 'video-final';
    const outputPath = path.join(renderRoot, `${outputName}.mp4`);

    const renderResult = spawnSync(
      'ffmpeg',
      ['-y', '-f', 'concat', '-safe', '0', '-i', concatFile, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outputPath],
      { encoding: 'utf-8' }
    );

    if (renderResult.status !== 0) {
      throw new Error(renderResult.stderr || 'FFmpeg falló concatenando el timeline.');
    }

    const publicUrl = `/renders/${userId}/${jobId}/${outputName}.mp4`;

    return NextResponse.json({
      mode: 'rendered',
      jobId,
      status: 'completed',
      videoUrl: publicUrl,
      scenesRendered: scenesWithAssets.length,
    });
  } catch (error) {
    console.error('Local export error:', error);
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'EROFS') {
      return NextResponse.json(
        {
          error:
            'Export local requiere un entorno con escritura de disco. En produccion serverless conecta un worker o storage externo para render persistente.',
        },
        { status: 501 }
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'No se pudo exportar el video localmente.',
      },
      { status: 500 }
    );
  }
}
