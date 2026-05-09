import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import { publishToInstagram, publishToFacebook, fetchMetaPages } from '@/lib/meta-ads';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type PublishResult = { success: boolean; id?: string; error?: string };

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const platforms = Array.isArray(body.platforms) ? body.platforms.map((item: unknown) => String(item)) : [];
    const caption = String(body.caption || '').trim();
    const imageUrl = String(body.imageUrl || '').trim() || undefined;
    const jobId = String(body.jobId || '').trim();

    if (!caption) {
      return NextResponse.json({ error: 'El caption es obligatorio.' }, { status: 400 });
    }

    if (!platforms.length) {
      return NextResponse.json({ error: 'Selecciona al menos una red social.' }, { status: 400 });
    }

    const account = await prisma.adAccount.findFirst({
      where: {
        userId,
        connected: true,
        platform: { in: ['instagram', 'facebook'] },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!account || !account.accessToken || account.accessToken.startsWith('oauth-code:')) {
      return NextResponse.json({
        staging: true,
        message: `Publicación simulada en ${platforms.join(', ')}. Conecta tu cuenta Meta en Ajustes → Integraciones para publicar de verdad.`,
        platforms,
        caption,
        imageUrl,
      });
    }

    const results: Record<string, PublishResult> = {};

    for (const platform of platforms) {
      try {
        if (platform === 'Instagram') {
          const pages = await fetchMetaPages(account.accessToken);
          const pageWithIg = pages.find((page) => page.igUserId);

          if (!pageWithIg?.igUserId) {
            results[platform] = {
              success: false,
              error: 'No se encontró cuenta de Instagram Business asociada a tu página de Facebook.',
            };
            continue;
          }

          const published = await publishToInstagram({
            accessToken: pageWithIg.accessToken,
            igUserId: pageWithIg.igUserId,
            caption,
            imageUrl,
          });

          results[platform] = { success: true, id: published.id };
          continue;
        }

        if (platform === 'Facebook') {
          const pages = await fetchMetaPages(account.accessToken);
          const page = pages[0];

          if (!page) {
            results[platform] = {
              success: false,
              error: 'No se encontró ninguna página de Facebook en tu cuenta.',
            };
            continue;
          }

          const published = await publishToFacebook({
            accessToken: page.accessToken,
            pageId: page.id,
            message: caption,
            imageUrl,
          });

          results[platform] = { success: true, id: published.id };
          continue;
        }

        if (platform === 'TikTok' || platform === 'YouTube') {
          results[platform] = {
            success: false,
            error: `Publicación en ${platform} próximamente. Conéctala desde Ajustes → Integraciones.`,
          };
          continue;
        }

        results[platform] = {
          success: false,
          error: `La plataforma ${platform} no está soportada todavía.`,
        };
      } catch (error) {
        results[platform] = {
          success: false,
          error: error instanceof Error ? error.message : 'Error publicando.',
        };
      }
    }

    if (jobId) {
      const job = await prisma.aiWorkspaceJob.findFirst({
        where: { id: jobId, userId },
        select: { output: true },
      });
      const existingOutput =
        job?.output && typeof job.output === 'object' && !Array.isArray(job.output)
          ? (job.output as Record<string, unknown>)
          : {};
      const nextOutput = JSON.parse(JSON.stringify({
        ...existingOutput,
        publishedAt: new Date().toISOString(),
        publishedTo: Object.entries(results)
          .filter(([, result]) => result.success)
          .map(([platform]) => platform),
      })) as Prisma.InputJsonValue;

      await prisma.aiWorkspaceJob.update({
        where: { id: jobId },
        data: { output: nextOutput },
      }).catch(() => null);
    }

    const anySuccess = Object.values(results).some((result) => result.success);
    const allFailed = Object.values(results).every((result) => !result.success);

    return NextResponse.json({
      staging: false,
      results,
      message: allFailed
        ? 'No se pudo publicar en ninguna red. Verifica que tu cuenta Meta esté conectada correctamente.'
        : anySuccess
        ? `Publicado exitosamente en ${Object.entries(results).filter(([, result]) => result.success).map(([platform]) => platform).join(', ')}.`
        : 'Publicación completada.',
    });
  } catch (error) {
    console.error('[publish] error:', error);
    return NextResponse.json({ error: 'Error al publicar.' }, { status: 500 });
  }
}
