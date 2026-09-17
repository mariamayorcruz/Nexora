import path from 'path';

/**
 * SEC-02: Destructive apply is fail-closed.
 * - Disabled when ENABLE_ADMIN_CODE_APPLY is absent or not exactly "true"
 * - Always disabled in production (NODE_ENV === 'production'), even if the flag is set
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

/**
 * Resolve a relative workspace path and reject escapes outside the repo root.
 */
export function resolveSafeWorkspacePath(relativePath: string, root = getWorkspaceRoot()) {
  const input = String(relativePath || '').trim();
  if (!input || input.includes('\0')) {
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
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (absolute !== root && !absolute.startsWith(rootWithSep)) {
    return null;
  }

  return absolute;
}
