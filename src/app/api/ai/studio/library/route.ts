import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';
import { isSupabaseStorageEnabled, getSupabaseReadUrl, deleteSupabaseObject } from '@/lib/storage';
import { unlink } from 'node:fs/promises';
import path from 'node:path';

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

    const items = await prisma.aiVideoAsset.findMany({
      where: {
        userId,
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });

    const hasSupabase = isSupabaseStorageEnabled();
    const assets = await Promise.all(
      items.map(async (item) => {
        if (hasSupabase && item.provider === 'supabase' && item.storageKey) {
          const readUrl = await getSupabaseReadUrl(item.storageKey);
          return {
            ...item,
            url: readUrl,
          };
        }

        return item;
      })
    );

    return NextResponse.json({ assets });
  } catch (error) {
    console.error('Nexora Studio library GET error:', error);
    return NextResponse.json({ error: 'No se pudo cargar tu biblioteca de videos.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = ensureUser(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as { id?: string; title?: string };
    const id = String(body.id || '').trim();
    const title = String(body.title || '').trim();

    if (!id || !title) {
      return NextResponse.json({ error: 'id y title son obligatorios.' }, { status: 400 });
    }

    const existing = await prisma.aiVideoAsset.findFirst({
      where: { id, userId, status: 'active' },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Asset no encontrado.' }, { status: 404 });
    }

    const asset = await prisma.aiVideoAsset.update({
      where: { id: existing.id },
      data: { title },
    });

    return NextResponse.json({ asset });
  } catch (error) {
    console.error('Nexora Studio library PATCH error:', error);
    return NextResponse.json({ error: 'No se pudo renombrar el video.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = ensureUser(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as { id?: string };
    const id = String(body.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'id es obligatorio.' }, { status: 400 });
    }

    const asset = await prisma.aiVideoAsset.findFirst({
      where: { id, userId, status: 'active' },
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset no encontrado.' }, { status: 404 });
    }

    if (asset.provider === 'supabase' && asset.storageKey && isSupabaseStorageEnabled()) {
      await deleteSupabaseObject(asset.storageKey);
    }

    if (asset.provider === 'library' && asset.relativeUrl) {
      const relativePath = asset.relativeUrl.replace(/^\//, '').replaceAll('/', path.sep);
      const localFile = path.join(process.cwd(), 'public', relativePath);
      try {
        await unlink(localFile);
      } catch {
        // Keep soft-delete even if local file is already missing.
      }
    }

    await prisma.aiVideoAsset.update({
      where: { id: asset.id },
      data: { status: 'deleted' },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Nexora Studio library DELETE error:', error);
    return NextResponse.json({ error: 'No se pudo eliminar el video.' }, { status: 500 });
  }
}
