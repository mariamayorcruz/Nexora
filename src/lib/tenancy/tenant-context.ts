/**
 * Point 7 Slice 1A — server-side TenantContext resolution.
 *
 * JWT remains identity-only (userId). Organization / Membership are resolved
 * and validated server-side. Client-supplied organization IDs are never trusted
 * without Membership + Organization ACTIVE checks.
 *
 * Business tables remain userId-owned in this slice — do not use TenantContext
 * as if CRM/campaigns/billing were already organization-scoped.
 */

import {
  MembershipRole,
  MembershipStatus,
  OrganizationStatus,
  type PrismaClient,
} from '@prisma/client';
import { getUserIdFromAuthorizationHeader } from '@/lib/jwt';
import { prisma as defaultPrisma } from '@/lib/prisma';

export const NEXORA_ORGANIZATION_HEADER = 'x-nexora-organization-id';

export type TenantContext = {
  userId: string;
  organizationId: string;
  membershipId: string;
  role: MembershipRole;
};

export type TenantContextErrorCode =
  | 'UNAUTHENTICATED'
  | 'NO_ACTIVE_MEMBERSHIP'
  | 'ORGANIZATION_SELECTION_REQUIRED'
  | 'ORGANIZATION_ACCESS_DENIED'
  | 'ORGANIZATION_INACTIVE'
  | 'MEMBERSHIP_INACTIVE';

export type ResolveTenantContextResult =
  | { ok: true; context: TenantContext }
  | { ok: false; code: TenantContextErrorCode; message: string };

function fail(
  code: TenantContextErrorCode,
  message: string
): Extract<ResolveTenantContextResult, { ok: false }> {
  return { ok: false, code, message };
}

function normalizeOrganizationId(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve trusted TenantContext from JWT identity + optional org header.
 * Default deny / fail closed.
 */
export async function resolveTenantContext(params: {
  authorizationHeader: string | null;
  organizationIdHeader?: string | null;
  db?: PrismaClient;
}): Promise<ResolveTenantContextResult> {
  const db = params.db || defaultPrisma;
  const userId = getUserIdFromAuthorizationHeader(params.authorizationHeader);
  if (!userId) {
    return fail('UNAUTHENTICATED', 'Valid authentication is required');
  }

  const requestedOrganizationId = normalizeOrganizationId(params.organizationIdHeader);

  if (requestedOrganizationId) {
    const membership = await db.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: requestedOrganizationId,
          userId,
        },
      },
      select: {
        id: true,
        role: true,
        status: true,
        organization: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!membership || membership.organization.id !== requestedOrganizationId) {
      return fail(
        'ORGANIZATION_ACCESS_DENIED',
        'No membership grants access to the requested organization'
      );
    }

    if (membership.status !== MembershipStatus.ACTIVE) {
      return fail('MEMBERSHIP_INACTIVE', 'Membership is not ACTIVE');
    }

    if (membership.organization.status !== OrganizationStatus.ACTIVE) {
      return fail('ORGANIZATION_INACTIVE', 'Organization is not ACTIVE');
    }

    return {
      ok: true,
      context: {
        userId,
        organizationId: membership.organization.id,
        membershipId: membership.id,
        role: membership.role,
      },
    };
  }

  const candidates = await db.membership.findMany({
    where: {
      userId,
      status: MembershipStatus.ACTIVE,
      organization: {
        status: OrganizationStatus.ACTIVE,
      },
    },
    select: {
      id: true,
      role: true,
      organizationId: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (candidates.length === 0) {
    return fail('NO_ACTIVE_MEMBERSHIP', 'No ACTIVE membership for an ACTIVE organization');
  }

  if (candidates.length > 1) {
    // Do not guess among multiple valid tenants.
    return fail(
      'ORGANIZATION_SELECTION_REQUIRED',
      'Multiple ACTIVE memberships require X-Nexora-Organization-Id'
    );
  }

  const only = candidates[0];
  return {
    ok: true,
    context: {
      userId,
      organizationId: only.organizationId,
      membershipId: only.id,
      role: only.role,
    },
  };
}

export function tenantContextHttpStatus(code: TenantContextErrorCode): number {
  switch (code) {
    case 'UNAUTHENTICATED':
      return 401;
    case 'ORGANIZATION_SELECTION_REQUIRED':
      return 409;
    case 'NO_ACTIVE_MEMBERSHIP':
    case 'ORGANIZATION_ACCESS_DENIED':
    case 'ORGANIZATION_INACTIVE':
    case 'MEMBERSHIP_INACTIVE':
      return 403;
    default:
      return 403;
  }
}
