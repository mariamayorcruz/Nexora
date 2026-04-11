import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin';
import { runAdminCodeAssistant, autoDetectMode, type AdminCodeAssistantMode } from '@/lib/admin-code-assistant';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const VALID_MODES = new Set([
  'review',
  'fix',
  'explain',
  'build',
  'debug',
  'refactor',
  'test',
  'ship',
]);

async function readIfExists(filePath: string, maxChars = 5000) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content.slice(0, maxChars);
  } catch {
    return '';
  }
}

async function readSiblingFiles(directoryPath: string, currentFileName?: string) {
  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => name !== currentFileName)
      .filter((name) => /\.(ts|tsx|js|jsx|json|md|prisma)$/i.test(name))
      .slice(0, 4);

    const siblingSnippets = await Promise.all(
      files.map(async (fileName) => {
        const fullPath = path.join(directoryPath, fileName);
        const content = await readIfExists(fullPath, 2500);
        if (!content) return '';
        return `### Related file (${fileName})\n${content}`;
      })
    );

    return siblingSnippets.filter(Boolean);
  } catch {
    return [];
  }
}

async function buildRepoContext(inputFilePath?: string) {
  const root = process.cwd();
  const packageJson = await readIfExists(path.join(root, 'package.json'), 3000);
  const tsconfig = await readIfExists(path.join(root, 'tsconfig.json'), 2500);
  const readme = await readIfExists(path.join(root, 'README.md'), 3500);
  const normalizedInputPath = inputFilePath ? inputFilePath.replace(/^[/\\]+/, '') : '';
  const targetAbsolutePath = normalizedInputPath ? path.join(root, normalizedInputPath) : '';
  const targetFile = targetAbsolutePath ? await readIfExists(targetAbsolutePath, 7000) : '';
  const targetDirectory = targetAbsolutePath ? path.dirname(targetAbsolutePath) : '';
  const siblingFiles = targetDirectory ? await readSiblingFiles(targetDirectory, path.basename(targetAbsolutePath)) : [];

  return [
    '## Project Root Context',
    packageJson ? `### package.json\n${packageJson}` : '### package.json\nNot available',
    tsconfig ? `### tsconfig.json\n${tsconfig}` : '### tsconfig.json\nNot available',
    readme ? `### README.md\n${readme}` : '### README.md\nNot available',
    normalizedInputPath
      ? `### Target file (${normalizedInputPath})\n${targetFile || 'Not available'}`
      : '### Target file\nNot provided',
    siblingFiles.length ? siblingFiles.join('\n\n') : '### Related files\nNot available',
  ].join('\n\n');
}

export async function POST(request: NextRequest) {
  const adminCheck = await verifyAdmin(request);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const body = (await request.json()) as {
      mode?: string;
      task?: string;
      code?: string;
      filePath?: string;
      stackHint?: string;
      includeRepoContext?: boolean;
    };

    const rawMode = String(body.mode || '').trim().toLowerCase();
    const task = String(body.task || '').trim();
    // Auto-detect mode from task description when mode is 'auto' or not provided
    const mode = (!rawMode || rawMode === 'auto' || !VALID_MODES.has(rawMode))
      ? autoDetectMode(task)
      : (rawMode as AdminCodeAssistantMode);
    const code = typeof body.code === 'string' ? body.code : '';
    const filePath = typeof body.filePath === 'string' ? body.filePath.trim() : '';
    const stackHint = typeof body.stackHint === 'string' ? body.stackHint.trim() : '';
    const includeRepoContext = body.includeRepoContext !== false;

    if (!task) {
      return NextResponse.json({ error: 'Describe la tarea para el asistente.' }, { status: 400 });
    }

    if (task.length > 5000 || code.length > 50000) {
      return NextResponse.json(
        { error: 'Entrada demasiado grande. Resume la tarea o pega un snippet mas corto.' },
        { status: 413 }
      );
    }

    const repoContext = includeRepoContext ? await buildRepoContext(filePath || undefined) : '';

    const result = await runAdminCodeAssistant({
      mode: mode as AdminCodeAssistantMode,
      task,
      code,
      filePath,
      stackHint,
      repoContext,
    });

    return NextResponse.json({
      result,
      detectedMode: mode,
      meta: {
        requestedBy: adminCheck.user.email,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Admin code assistant error:', error);
    return NextResponse.json({ error: 'No se pudo generar respuesta del asistente de codigo.' }, { status: 500 });
  }
}
