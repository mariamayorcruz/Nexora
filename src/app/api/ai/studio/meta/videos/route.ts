import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import { fetchMetaAdVideos } from '@/lib/meta-ads';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, Math.min(Number(searchParams.get('limit') || 12), 20));

    const account = await prisma.adAccount.findFirst({
      where: {
        userId,
        connected: true,
        platform: { in: ['instagram', 'facebook'] },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!account || !account.accessToken || account.accessToken.startsWith('oauth-code:')) {
      return NextResponse.json(
        {
          error: 'No hay una cuenta Meta conectada con token real. Reconecta Meta desde Command Center.',
        },
        { status: 412 }
      );
    }

    const videos = await fetchMetaAdVideos({
      accessToken: account.accessToken,
      accountId: account.accountId,
      limit,
    });

    return NextResponse.json({
      assets: videos.map((video) => ({
        id: `meta-${video.id}`,
        title: video.title,
        url: video.url,
        provider: 'meta',
        thumbnailUrl: video.thumbnailUrl,
        durationSec: video.durationSec,
        createdAt: video.createdAt,
      })),
      meta: {
        source: 'meta',
        accountId: account.accountId,
        count: videos.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar videos desde Meta.';
    const invalidToken = /token|oauth|permission|permissions|expired/i.test(message);

    return NextResponse.json(
      {
        error: invalidToken
          ? 'Token de Meta invalido o vencido. Reconecta tu cuenta Meta e intenta de nuevo.'
          : 'No se pudieron cargar videos desde Meta.',
        details: message,
      },
      { status: invalidToken ? 401 : 500 }
    );
  }
}
