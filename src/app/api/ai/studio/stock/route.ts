import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import { searchStockMedia, type MediaKind } from '@/lib/video-pipeline';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthorizationHeader(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = String(searchParams.get('q') || '').trim();
    const kindParam = String(searchParams.get('kind') || 'video').toLowerCase();
    const kind: MediaKind = kindParam === 'image' ? 'image' : 'video';
    const limit = Math.min(12, Math.max(1, Number(searchParams.get('limit') || 8)));

    if (!query) {
      return NextResponse.json({ error: 'Debes enviar q con una idea de busqueda.' }, { status: 400 });
    }

    const assets = await searchStockMedia(query, kind, limit);

    return NextResponse.json({
      assets,
      meta: {
        query,
        kind,
        count: assets.length,
      },
    });
  } catch (error) {
    console.error('Nexora Studio stock search error:', error);
    return NextResponse.json({ error: 'No se pudo buscar media gratis.' }, { status: 500 });
  }
}
