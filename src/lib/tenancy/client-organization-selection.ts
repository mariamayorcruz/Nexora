/**
 * Point 8B-5C — client organization selection helpers (UX preference only).
 *
 * Browser selection / localStorage is NEVER tenant authority.
 * Server resolveTenantContext revalidates Membership + Organization on every request.
 */

export const SELECTED_ORGANIZATION_STORAGE_KEY = 'nexora_selected_organization_id';

/** Canonical header name (HTTP is case-insensitive; match server constant). */
export const NEXORA_ORGANIZATION_HEADER_NAME = 'x-nexora-organization-id';

export type ClientOrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export type ClientOrganization = {
  id: string;
  name: string;
  slug: string;
  role: ClientOrganizationRole;
};

export type ClientOrganizationSelectionResult = {
  selectedOrganizationId: string | null;
  /** True when user must explicitly choose among multiple orgs. */
  selectionRequired: boolean;
  /** True when a stored preference was rejected (stale/unowned). */
  discardedStalePreference: boolean;
};

/**
 * Pure UX selection resolver. Not authorization.
 */
export function resolveClientOrganizationSelection(
  organizations: ClientOrganization[],
  storedOrganizationId: string | null | undefined
): ClientOrganizationSelectionResult {
  const usable = Array.isArray(organizations) ? organizations : [];
  const stored =
    storedOrganizationId == null ? null : String(storedOrganizationId).trim() || null;

  if (usable.length === 0) {
    return {
      selectedOrganizationId: null,
      selectionRequired: false,
      discardedStalePreference: Boolean(stored),
    };
  }

  if (usable.length === 1) {
    const onlyId = usable[0].id;
    const discardedStalePreference = Boolean(stored && stored !== onlyId);
    return {
      selectedOrganizationId: onlyId,
      selectionRequired: false,
      discardedStalePreference,
    };
  }

  if (stored && usable.some((org) => org.id === stored)) {
    return {
      selectedOrganizationId: stored,
      selectionRequired: false,
      discardedStalePreference: false,
    };
  }

  return {
    selectedOrganizationId: null,
    selectionRequired: true,
    discardedStalePreference: Boolean(stored),
  };
}

export function readStoredOrganizationId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SELECTED_ORGANIZATION_STORAGE_KEY);
    if (raw == null) return null;
    const trimmed = String(raw).trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export function writeStoredOrganizationId(organizationId: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = String(organizationId || '').trim();
  if (!trimmed) return;
  try {
    window.localStorage.setItem(SELECTED_ORGANIZATION_STORAGE_KEY, trimmed);
  } catch {
    // ignore quota / private mode
  }
}

export function clearStoredOrganizationId(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SELECTED_ORGANIZATION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

const RESERVED_TENANT_HEADER_NAMES = new Set([
  'authorization',
  'x-nexora-organization-id',
]);

function isReservedTenantHeaderName(name: string): boolean {
  return RESERVED_TENANT_HEADER_NAMES.has(String(name || '').trim().toLowerCase());
}

/**
 * Build Authorization (+ optional org header) for tenant-scoped requests.
 * organizationId must come from VALIDATED client selection state only.
 *
 * Reserved headers (Authorization, X-Nexora-Organization-Id) are assigned LAST
 * and cannot be overridden by additionalHeaders (any casing).
 */
export function buildTenantHeaders(params: {
  token: string;
  organizationId?: string | null;
  additionalHeaders?: HeadersInit;
}): Record<string, string> {
  const token = String(params.token || '').trim();
  const headers: Record<string, string> = {};

  if (params.additionalHeaders) {
    const extra =
      params.additionalHeaders instanceof Headers
        ? Object.fromEntries(params.additionalHeaders.entries())
        : Array.isArray(params.additionalHeaders)
          ? Object.fromEntries(params.additionalHeaders)
          : params.additionalHeaders;
    for (const [key, value] of Object.entries(extra)) {
      if (typeof value !== 'string') continue;
      if (isReservedTenantHeaderName(key)) continue;
      headers[key] = value;
    }
  }

  // Canonical reserved headers always win (defense-in-depth).
  headers.Authorization = `Bearer ${token}`;

  const organizationId =
    params.organizationId == null ? null : String(params.organizationId).trim() || null;
  if (organizationId) {
    headers['X-Nexora-Organization-Id'] = organizationId;
  }

  return headers;
}

export const TENANT_CONTEXT_ERROR_CODES = new Set([
  'ORGANIZATION_SELECTION_REQUIRED',
  'ORGANIZATION_ACCESS_DENIED',
  'ORGANIZATION_INACTIVE',
  'MEMBERSHIP_INACTIVE',
  'NO_ACTIVE_MEMBERSHIP',
]);

export function isOrganizationSelectionRequired(status: number, code: unknown): boolean {
  return status === 409 && code === 'ORGANIZATION_SELECTION_REQUIRED';
}

export function isTenantAccessDenied(status: number, code: unknown): boolean {
  return (
    status === 403 &&
    typeof code === 'string' &&
    TENANT_CONTEXT_ERROR_CODES.has(code) &&
    code !== 'ORGANIZATION_SELECTION_REQUIRED'
  );
}
