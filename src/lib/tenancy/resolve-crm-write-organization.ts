/**
 * Point 8B-5B — CRM organization-scoped WRITE resolution (server-only).
 *
 * Interactive CRM writes authorize via trusted TenantContext:
 *   userId          = actor / provenance
 *   organizationId  = tenant ownership
 *
 * Thin wrapper around resolveTenantContext. Does NOT create/repair tenant state.
 * Does NOT use buildLegacyOrganizationId. Does NOT trust body/query organizationId.
 *
 * Meta/integration writes remain on resolveLegacyCrmWriteOrganization until
 * integrations are organization-owned.
 *
 * Role policy (transitional): any ACTIVE Membership role (OWNER/ADMIN/MEMBER)
 * may perform existing CRM write operations. Granular RBAC is Point 30.
 */

import { NextResponse } from 'next/server';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  NEXORA_ORGANIZATION_HEADER,
  resolveTenantContext,
  tenantContextHttpStatus,
  type TenantContext,
  type TenantContextErrorCode,
} from '@/lib/tenancy/tenant-context';

type TenantDbClient = Prisma.TransactionClient | PrismaClient;

export type ResolveCrmWriteOrganizationResult =
  | { ok: true; context: TenantContext }
  | { ok: false; code: TenantContextErrorCode; message: string };

/**
 * Resolve trusted TenantContext for CRM writes.
 * organizationId from body/query/client is never accepted — only JWT + org header.
 */
export async function resolveCrmWriteOrganization(params: {
  authorizationHeader: string | null;
  organizationIdHeader?: string | null;
  db?: TenantDbClient;
}): Promise<ResolveCrmWriteOrganizationResult> {
  return resolveTenantContext({
    authorizationHeader: params.authorizationHeader,
    organizationIdHeader: params.organizationIdHeader,
    db: params.db,
  });
}

/** Safe client-facing CRM write error (no tenant internals). */
export function crmWriteClientMessage(code: TenantContextErrorCode): string {
  switch (code) {
    case 'UNAUTHENTICATED':
      return 'Unauthorized';
    case 'ORGANIZATION_SELECTION_REQUIRED':
      return 'Organization selection required';
    default:
      return 'CRM write organization access denied';
  }
}

export function crmWriteHttpStatus(code: TenantContextErrorCode): number {
  return tenantContextHttpStatus(code);
}

export function crmWriteErrorResponse(
  result: Extract<ResolveCrmWriteOrganizationResult, { ok: false }>
) {
  return NextResponse.json(
    { error: crmWriteClientMessage(result.code), code: result.code },
    { status: crmWriteHttpStatus(result.code) }
  );
}

export { NEXORA_ORGANIZATION_HEADER };
