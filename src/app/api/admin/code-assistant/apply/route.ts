import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { verifyAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

type CodeFile = {
  path: string;
  action: 'create' | 'modify' | 'delete';
  code: string;
};

function resolveSafePath(relativePath: string) {
  const root = process.cwd();
  const cleaned = relativePath.replace(/^[\\/]+/, '').replace(/\.{2,}/g, '.');
  const absolute = path.resolve(root, cleaned);
  if (!absolute.startsWith(root)) {
    return null;
  }
  return absolute;
}

async function applyCodeFile(file: CodeFile) {
  const targetPath = resolveSafePath(file.path);
  if (!targetPath) {
    throw new Error(`Ruta invalida: ${file.path}`);
  }

  if (file.action === 'delete') {
    await fs.rm(targetPath, { force: true });
    return;
  }

  const dir = path.dirname(targetPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(targetPath, file.code || '', 'utf8');
}

export async function POST(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const body = (await request.json()) as {
      codeFiles?: CodeFile[];
      dryRun?: boolean;
    };

    const codeFiles = Array.isArray(body.codeFiles) ? body.codeFiles : [];
    if (codeFiles.length === 0) {
      return NextResponse.json({ error: 'No hay archivos para aplicar.' }, { status: 400 });
    }

    const sanitized = codeFiles
      .filter((file) => file && typeof file.path === 'string' && file.path.trim().length > 0)
      .slice(0, 20)
      .map((file) => ({
        path: String(file.path).trim(),
        action: file.action === 'create' || file.action === 'modify' || file.action === 'delete' ? file.action : 'modify',
        code: typeof file.code === 'string' ? file.code : '',
      }));

    if (sanitized.length === 0) {
      return NextResponse.json({ error: 'No hay archivos validos para aplicar.' }, { status: 400 });
    }

    if (body.dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        files: sanitized.map((file) => ({ path: file.path, action: file.action })),
      });
    }

    for (const file of sanitized) {
      await applyCodeFile(file);
    }

    return NextResponse.json({
      ok: true,
      applied: sanitized.length,
      files: sanitized.map((file) => ({ path: file.path, action: file.action })),
    });
  } catch (error) {
    console.error('Admin code apply error:', error);
    return NextResponse.json({ error: 'No se pudieron aplicar los cambios.' }, { status: 500 });
  }
}
