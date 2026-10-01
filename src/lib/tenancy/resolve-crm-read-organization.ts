/**
 * Point 8B-4 — CRM organization-scoped READ resolution (server-only).
 *
 * Tenant-facing CrmLead reads authorize solely by TenantContext.organizationId.
 * No userId read fallback. No organizationId IS NULL fallback.
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

export type ResolveCrmReadOrganizationResult =
  | { ok: true; context: TenantContext }
  | { ok: false; code: TenantContextErrorCode; message: string };

/**
 * Resolve trusted TenantContext for CRM reads.
 * organizationId from body/query/client is never accepted — only JWT + org header.
 */
export async function resolveCrmReadOrganization(params: {
  authorizationHeader: string | null;
  organizationIdHeader?: string | null;
  db?: TenantDbClient;
}): Promise<ResolveCrmReadOrganizationResult> {
  return resolveTenantContext({
    authorizationHeader: params.authorizationHeader,
    organizationIdHeader: params.organizationIdHeader,
    db: params.db,
  });
}

/** Safe client-facing CRM read error (no tenant internals). */
export function crmReadClientMessage(code: TenantContextErrorCode): string {
  switch (code) {
    case 'UNAUTHENTICATED':
      return 'Unauthorized';
    case 'ORGANIZATION_SELECTION_REQUIRED':
      return 'Organization selection required';
    default:
      return 'CRM organization access denied';
  }
}

export function crmReadErrorResponse(result: Extract<ResolveCrmReadOrganizationResult, { ok: false }>) {
  return NextResponse.json(
    { error: crmReadClientMessage(result.code), code: result.code },
    { status: tenantContextHttpStatus(result.code) }
  );
}

export { NEXORA_ORGANIZATION_HEADER };
