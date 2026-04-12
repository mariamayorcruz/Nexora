import { NextRequest, NextResponse } from 'next/server';
import { FREE_MUSIC_LIBRARY, searchFreeLibrary } from '@/lib/music/free-library';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') || '';
  const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 20);
  const limit = Math.max(1, Math.min(50, limitRaw));

  const tracks = (query ? searchFreeLibrary(query) : FREE_MUSIC_LIBRARY).slice(0, limit);

  return NextResponse.json({
    tracks,
    total: tracks.length,
    source: 'free-library',
  });
}
