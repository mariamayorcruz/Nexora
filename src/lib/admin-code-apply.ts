import fs from 'fs/promises';
import path from 'path';

/**
 * SEC-02: Destructive apply is fail-closed.
 * - Disabled when ENABLE_ADMIN_CODE_APPLY is absent or not exactly "true"
 * - Always disabled in production (NODE_ENV === 'production'), even if the flag is set
 *
 * Application-level realpath checks reduce symlink escapes but cannot fully eliminate
 * filesystem TOCTOU races. Acceptable here because production apply is always off,
 * non-production requires an explicit flag, and verifyAdmin is required.
 */
export function isAdminCodeApplyEnabled() {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return process.env.ENABLE_ADMIN_CODE_APPLY === 'true';
}

export function getAdminCodeApplyDisabledReason() {
  if (process.env.NODE_ENV === 'production') {
    return 'Code apply is disabled in production.';
  }
  return 'Code apply is disabled. Set ENABLE_ADMIN_CODE_APPLY=true only in non-production environments.';
}

function getWorkspaceRoot() {
  return path.resolve(process.cwd());
}

function isInsideRoot(candidate: string, root: string) {
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  return candidate === root || candidate.startsWith(rootWithSep);
}

/**
 * Lexical resolve of a relative workspace path. Rejects empty input, NUL, absolute
 * paths, `..` segments, and lexical escapes outside root. Does not follow symlinks.
 */
export function resolveSafeWorkspacePath(relativePath: string, root = getWorkspaceRoot()) {
  const input = String(relativePath || '').trim();
  // Explicit NUL (U+0000) — not the two-character sequence backslash + "0"
  if (!input || input.includes('\u0000')) {
    return null;
  }

  if (path.isAbsolute(input)) {
    return null;
  }

  const normalizedInput = input.replace(/\\/g, '/');
  const segments = normalizedInput.split('/').filter((segment) => segment.length > 0);
  if (segments.some((segment) => segment === '..')) {
    return null;
  }

  const absolute = path.resolve(root, ...segments);
  if (!isInsideRoot(absolute, root)) {
    return null;
  }

  return absolute;
}

async function findDeepestExistingAncestor(absolutePath: string) {
  let current = absolutePath;
  while (true) {
    try {
      await fs.lstat(current);
      return current;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT') {
        throw error;
      }
      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }
      current = parent;
    }
  }
}

/**
 * Filesystem-aware boundary check for real mutations.
 * Resolves the workspace root and the deepest existing ancestor via realpath so
 * symlinked parents (or existing symlink targets) cannot redirect writes/deletes
 * outside the real workspace root.
 *
 * Rejects paths whose existing ancestor (or the target itself) resolves outside root.
 * Does not create or mutate files.
 */
export async function assertSafeWorkspaceMutationPath(
  relativePath: string,
  root = getWorkspaceRoot()
) {
  const lexicalPath = resolveSafeWorkspacePath(relativePath, root);
  if (!lexicalPath) {
    return null;
  }

  let realRoot: string;
  try {
    realRoot = await fs.realpath(root);
  } catch {
    return null;
  }

  const existingAncestor = await findDeepestExistingAncestor(lexicalPath);
  if (!existingAncestor) {
    return null;
  }

  let realAncestor: string;
  try {
    realAncestor = await fs.realpath(existingAncestor);
  } catch {
    return null;
  }

  if (!isInsideRoot(realAncestor, realRoot)) {
    return null;
  }

  // If the target itself exists, ensure following it (symlink or otherwise) stays inside.
  if (existingAncestor === lexicalPath) {
    if (!isInsideRoot(realAncestor, realRoot)) {
      return null;
    }
    return realAncestor;
  }

  // Target does not exist yet: ensure the joined path under the real ancestor stays inside.
  const relativeFromAncestor = path.relative(existingAncestor, lexicalPath);
  if (
    !relativeFromAncestor ||
    relativeFromAncestor.startsWith('..') ||
    path.isAbsolute(relativeFromAncestor)
  ) {
    return null;
  }

  const projected = path.resolve(realAncestor, relativeFromAncestor);
  if (!isInsideRoot(projected, realRoot)) {
    return null;
  }

  return projected;
}
