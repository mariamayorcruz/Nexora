import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, verifyUserToken } from '@/lib/jwt';
import { isSupabaseStorageEnabled, uploadVideoToSupabase } from '@/lib/storage';
import { prisma } from '@/lib/prisma';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
]);

function ensureUser(request: NextRequest) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) return null;
  const decoded = verifyUserToken(token);
  return decoded?.userId || null;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'upload-video';
}

function resolveExtension(fileName: string, mimeType: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext) return ext;

  if (mimeType === 'video/mp4') return '.mp4';
  if (mimeType === 'video/quicktime') return '.mov';
  if (mimeType === 'video/webm') return '.webm';
  if (mimeType === 'video/x-matroska') return '.mkv';
  return '.mp4';
}

export async function POST(request: NextRequest) {
  try {
    const userId = ensureUser(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Debes seleccionar un archivo de video.' }, { status: 400 });
    }

    if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Formato no soportado. Usa MP4, MOV, WEBM o MKV.' }, { status: 400 });
    }

    const maxBytes = 300 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: 'El video supera 300MB.' }, { status: 400 });
    }

    const ext = resolveExtension(file.name, file.type);
    const baseName = safeFileName(path.basename(file.name, path.extname(file.name)));
    const fileName = `${Date.now()}-${baseName}${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    if (isSupabaseStorageEnabled()) {
      const uploaded = await uploadVideoToSupabase({
        userId,
        fileName,
        contentType: file.type,
        buffer,
      });

      const asset = await prisma.aiVideoAsset.create({
        data: {
          userId,
          provider: uploaded.provider,
          title: file.name,
          url: uploaded.url,
          storageKey: uploaded.key,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      });

      return NextResponse.json({
        asset: {
          ...asset,
          kind: 'video',
        },
      });
    }

    const uploadRoot = path.join(process.cwd(), 'public', 'uploads', userId);
    await mkdir(uploadRoot, { recursive: true });
    const filePath = path.join(uploadRoot, fileName);
    await writeFile(filePath, buffer);

    const relativeUrl = `/uploads/${userId}/${fileName}`;
    const absoluteUrl = new URL(relativeUrl, request.nextUrl.origin).toString();

    const asset = await prisma.aiVideoAsset.create({
      data: {
        userId,
        provider: 'library',
        title: file.name,
        url: absoluteUrl,
        relativeUrl,
        mimeType: file.type,
        sizeBytes: file.size,
      },
    });

    return NextResponse.json({
      asset: {
        ...asset,
        kind: 'video',
      },
    });
  } catch (error) {
    console.error('Nexora Studio upload error:', error);
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'EROFS') {
      return NextResponse.json(
        {
          error:
            'Este entorno no permite guardar archivos locales (disco de solo lectura). Para subir videos en produccion necesitas conectar un storage externo como S3, R2 o Supabase Storage.',
        },
        { status: 501 }
      );
    }
    return NextResponse.json({ error: 'No se pudo subir el video.' }, { status: 500 });
  }
}
