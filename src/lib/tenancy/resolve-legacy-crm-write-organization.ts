/**
 * Point 8B-2 — transitional CRM write ownership (server-only).
 *
 * Validates and returns the deterministic legacy organizationId for CrmLead CREATE dual-write.
 * Does NOT create/repair tenant state. Does NOT authorize multi-org CRM writes.
 * Does NOT backfill existing rows.
 *
 * Allowed write organization before read cutover:
 *   buildLegacyOrganizationId(userId)  ONLY
 */

import {
  MembershipRole,
  MembershipStatus,
  OrganizationStatus,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import {
  buildLegacyOrganizationId,
  parseLegacyOrganizationUserId,
} from '@/lib/tenancy/legacy-organization-backfill';
import {
  NEXORA_ORGANIZATION_HEADER,
  resolveTenantContext,
  tenantContextHttpStatus,
  type TenantContextErrorCode,
} from '@/lib/tenancy/tenant-context';
import { prisma as defaultPrisma } from '@/lib/prisma';

export type TenantDbClient = Prisma.TransactionClient | PrismaClient;

export type LegacyCrmWriteErrorCode =
  | 'missing_user_id'
  | 'legacy_crm_organization_missing'
  | 'legacy_crm_organization_inactive'
  | 'legacy_crm_membership_missing'
  | 'legacy_crm_membership_inactive'
  | 'legacy_crm_mapping_inconsistent'
  | 'crm_multi_org_write_not_ready'
  | TenantContextErrorCode;

export type ResolveLegacyCrmWriteOrganizationResult =
  | { ok: true; organizationId: string }
  | { ok: false; code: LegacyCrmWriteErrorCode; message: string };

function fail(
  code: LegacyCrmWriteErrorCode,
  message: string
): Extract<ResolveLegacyCrmWriteOrganizationResult, { ok: false }> {
  return { ok: false, code, message };
}

function normalizeOrganizationId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validate deterministic legacy Organization + OWNER/ACTIVE Membership for userId.
 * Never creates or repairs rows.
 */
async function assertDeterministicLegacyCrmWriteOrg(
  db: TenantDbClient,
  userId: string
): Promise<ResolveLegacyCrmWriteOrganizationResult> {
  const expectedOrganizationId = buildLegacyOrganizationId(userId);

  const mappedUserId = parseLegacyOrganizationUserId(expectedOrganizationId);
  if (!mappedUserId || mappedUserId !== userId) {
    return fail(
      'legacy_crm_mapping_inconsistent',
      'Deterministic legacy organization mapping is inconsistent'
    );
  }

  const organization = await db.organization.findUnique({
    where: { id: expectedOrganizationId },
    select: { id: true, status: true },
  });

  if (!organization) {
    return fail(
      'legacy_crm_organization_missing',
      'Deterministic legacy organization is missing'
    );
  }

  if (organization.status !== OrganizationStatus.ACTIVE) {
    return fail(
      'legacy_crm_organization_inactive',
      'Deterministic legacy organization is not ACTIVE'
    );
  }

  const membership = await db.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: expectedOrganizationId,
        userId,
      },
    },
    select: { id: true, status: true, role: true, organizationId: true, userId: true },
  });

  if (!membership) {
    return fail(
      'legacy_crm_membership_missing',
      'Expected legacy membership is missing'
    );
  }

  if (membership.status !== MembershipStatus.ACTIVE) {
    return fail(
      'legacy_crm_membership_inactive',
      'Expected legacy membership is not ACTIVE'
    );
  }

  if (
    membership.organizationId !== expectedOrganizationId ||
    membership.userId !== userId ||
    membership.role !== MembershipRole.OWNER
  ) {
    return fail(
      'legacy_crm_mapping_inconsistent',
      'Expected legacy ownership mapping is inconsistent'
    );
  }

  return { ok: true, organizationId: expectedOrganizationId };
}

/**
 * Resolve the only organizationId permitted for CrmLead CREATE during Point 8B-2.
 *
 * - No org header: validate deterministic legacy org for userId.
 * - Org header present: resolve via TenantContext; must equal deterministic legacy org.
 * - Valid non-legacy selected org: fail closed (crm_multi_org_write_not_ready).
 *
 * Does not call ensureUserOrganization.
 */
export async function resolveLegacyCrmWriteOrganization(params: {
  userId: string;
  /** When set, validated via TenantContext and must equal deterministic legacy org. */
  organizationIdHeader?: string | null;
  /** Required when organizationIdHeader is set (TenantContext auth). */
  authorizationHeader?: string | null;
  db?: TenantDbClient;
}): Promise<ResolveLegacyCrmWriteOrganizationResult> {
  const userId = String(params.userId || '').trim();
  if (!userId) {
    return fail('missing_user_id', 'userId is required');
  }

  const db = params.db || defaultPrisma;
  const expectedOrganizationId = buildLegacyOrganizationId(userId);
  const requestedOrganizationId = normalizeOrganizationId(params.organizationIdHeader);

  if (requestedOrganizationId) {
    const resolved = await resolveTenantContext({
      authorizationHeader: params.authorizationHeader ?? null,
      organizationIdHeader: requestedOrganizationId,
      db,
    });

    if (!resolved.ok) {
      return fail(resolved.code, resolved.message);
    }

    if (resolved.context.userId !== userId) {
      return fail(
        'legacy_crm_mapping_inconsistent',
        'Tenant context user does not match CRM write user'
      );
    }

    if (resolved.context.organizationId !== expectedOrganizationId) {
      return fail(
        'crm_multi_org_write_not_ready',
        'CRM writes into non-legacy organizations are not enabled yet'
      );
    }
  }

  return assertDeterministicLegacyCrmWriteOrg(db, userId);
}

export function legacyCrmWriteHttpStatus(code: LegacyCrmWriteErrorCode): number {
  switch (code) {
    case 'missing_user_id':
    case 'UNAUTHENTICATED':
      return 401;
    case 'crm_multi_org_write_not_ready':
    case 'ORGANIZATION_SELECTION_REQUIRED':
      return 409;
    case 'legacy_crm_organization_missing':
    case 'legacy_crm_organization_inactive':
    case 'legacy_crm_membership_missing':
    case 'legacy_crm_membership_inactive':
    case 'legacy_crm_mapping_inconsistent':
    case 'NO_ACTIVE_MEMBERSHIP':
    case 'ORGANIZATION_ACCESS_DENIED':
    case 'ORGANIZATION_INACTIVE':
    case 'MEMBERSHIP_INACTIVE':
      return 403;
    default:
      return tenantContextHttpStatus(code as TenantContextErrorCode);
  }
}

/** Stable client-safe error message (no tenant internals). */
export function legacyCrmWriteClientMessage(code: LegacyCrmWriteErrorCode): string {
  switch (code) {
    case 'missing_user_id':
    case 'UNAUTHENTICATED':
      return 'Unauthorized';
    case 'crm_multi_org_write_not_ready':
      return 'CRM organization write transition is not ready';
    case 'ORGANIZATION_SELECTION_REQUIRED':
      return 'Organization selection required';
    default:
      return 'CRM write organization is not available';
  }
}

export { NEXORA_ORGANIZATION_HEADER };

/**
 * Strip organizationId from CRM API responses so clients stay unaware of ownership assignment.
 * Additive Prisma scalar must not change intentional public response shapes.
 */
export function omitCrmLeadOrganizationId<T extends { organizationId?: string | null }>(
  lead: T
): Omit<T, 'organizationId'> {
  const { organizationId: _ignored, ...rest } = lead;
  void _ignored;
  return rest;
}
