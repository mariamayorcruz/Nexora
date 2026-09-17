import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { verifyAdmin } from '@/lib/admin';
import {
  assertSafeWorkspaceMutationPath,
  getAdminCodeApplyDisabledReason,
  isAdminCodeApplyEnabled,
  resolveSafeWorkspacePath,
} from '@/lib/admin-code-apply';

export const dynamic = 'force-dynamic';

type CodeFile = {
  path: string;
  action: 'create' | 'modify' | 'delete';
  code: string;
};

async function applyCodeFile(file: CodeFile) {
  // Filesystem-aware check immediately before each mutation (not lexical-only).
  const targetPath = await assertSafeWorkspaceMutationPath(file.path);
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

export async function GET(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  const enabled = isAdminCodeApplyEnabled();
  return NextResponse.json({
    applyEnabled: enabled,
    dryRunAllowed: true,
    reason: enabled
      ? 'Code apply enabled for non-production admin use.'
      : getAdminCodeApplyDisabledReason(),
  });
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
        action:
          file.action === 'create' || file.action === 'modify' || file.action === 'delete'
            ? file.action
            : 'modify',
        code: typeof file.code === 'string' ? file.code : '',
      }));

    if (sanitized.length === 0) {
      return NextResponse.json({ error: 'No hay archivos validos para aplicar.' }, { status: 400 });
    }

    for (const file of sanitized) {
      if (!resolveSafeWorkspacePath(file.path)) {
        return NextResponse.json({ error: `Ruta invalida: ${file.path}` }, { status: 400 });
      }
    }

    if (body.dryRun) {
      // Non-destructive: no create/write/delete. Still reject paths already proven unsafe
      // via realpath (e.g. existing symlink ancestors that escape the workspace).
      for (const file of sanitized) {
        const safe = await assertSafeWorkspaceMutationPath(file.path);
        if (!safe) {
          return NextResponse.json({ error: `Ruta invalida: ${file.path}` }, { status: 400 });
        }
      }
      return NextResponse.json({
        ok: true,
        dryRun: true,
        applyEnabled: isAdminCodeApplyEnabled(),
        files: sanitized.map((file) => ({ path: file.path, action: file.action })),
      });
    }

    if (!isAdminCodeApplyEnabled()) {
      return NextResponse.json(
        {
          error: getAdminCodeApplyDisabledReason(),
          applyEnabled: false,
        },
        { status: 403 }
      );
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
    console.error('Admin code apply error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No se pudieron aplicar los cambios.' }, { status: 500 });
  }
}
