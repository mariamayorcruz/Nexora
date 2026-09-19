/**
 * Point 7 Slice 1A — ensure deterministic Organization + OWNER/ACTIVE Membership
 * for a User (server-only lifecycle helper).
 *
 * Uses Slice 0 pure planners from legacy-organization-backfill.ts.
 * Fail closed on incompatible state. Never attaches a User to another tenant.
 */

import {
  MembershipRole,
  MembershipStatus,
  OrganizationStatus,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import {
  buildLegacyOrganizationId,
  planLegacyOrganizationBackfill,
  resolveLegacyOrganizationName,
  buildLegacyOrganizationSlug,
} from '@/lib/tenancy/legacy-organization-backfill';

export type TenantDbClient = Prisma.TransactionClient | PrismaClient;

export type EnsureUserOrganizationResult = {
  organizationId: string;
  membershipId: string;
  createdOrganization: boolean;
  createdMembership: boolean;
};

export class TenantLifecycleError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TenantLifecycleError';
    this.code = code;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Idempotent ensure of legacy_org_<userId> + OWNER/ACTIVE Membership.
 * Prefer calling inside the same Prisma transaction that creates the User.
 */
export async function ensureUserOrganization(
  db: TenantDbClient,
  params: {
    userId: string;
    onboardingData?: unknown;
    automationBusinessName?: string | null;
  }
): Promise<EnsureUserOrganizationResult> {
  const userId = String(params.userId || '').trim();
  if (!userId) {
    throw new TenantLifecycleError('missing_user_id', 'userId is required');
  }

  const organizationId = buildLegacyOrganizationId(userId);

  const existingOrganization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true, status: true },
  });

  const existingMembership = await db.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      role: true,
      status: true,
    },
  });

  const organizationMembershipCount = existingOrganization
    ? await db.membership.count({ where: { organizationId } })
    : 0;

  const plan = planLegacyOrganizationBackfill({
    userId,
    onboardingData: params.onboardingData,
    automationBusinessName: params.automationBusinessName,
    existingOrganization,
    existingMembership,
    organizationMembershipCount,
  });

  if (plan.action === 'conflict') {
    throw new TenantLifecycleError(plan.reason, `Tenant lifecycle conflict: ${plan.reason}`);
  }

  if (plan.action === 'already_mapped' && plan.membershipAction === 'already_present') {
    return {
      organizationId: plan.organizationId,
      membershipId: plan.membershipId!,
      createdOrganization: false,
      createdMembership: false,
    };
  }

  // Planned create (org and/or membership). Check slug ownership before writes.
  if (plan.action === 'create') {
    const slugOwner = await db.organization.findUnique({
      where: { slug: plan.slug },
      select: { id: true },
    });
    if (slugOwner && slugOwner.id !== plan.organizationId) {
      throw new TenantLifecycleError(
        'slug_owned_by_different_organization',
        'Deterministic organization slug is already owned by a different Organization'
      );
    }
  }

  try {
    let createdOrganization = false;
    let createdMembership = false;
    let membershipId = existingMembership?.id || '';

    if (plan.action === 'create') {
      await db.organization.create({
        data: {
          id: plan.organizationId,
          name: plan.name,
          slug: plan.slug,
          status: OrganizationStatus.ACTIVE,
        },
      });
      createdOrganization = true;
    }

    if (plan.membershipAction === 'create') {
      const membership = await db.membership.create({
        data: {
          organizationId: plan.organizationId,
          userId: plan.userId,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
        select: { id: true },
      });
      membershipId = membership.id;
      createdMembership = true;
    }

    if (!membershipId) {
      throw new TenantLifecycleError(
        'membership_missing_after_ensure',
        'Membership id missing after ensureUserOrganization'
      );
    }

    return {
      organizationId: plan.organizationId,
      membershipId,
      createdOrganization,
      createdMembership,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Race: re-read and require a clean already_mapped outcome (no silent rewrite).
      const org = await db.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, slug: true, status: true },
      });
      const membership = await db.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
        select: {
          id: true,
          organizationId: true,
          userId: true,
          role: true,
          status: true,
        },
      });
      const count = org ? await db.membership.count({ where: { organizationId } }) : 0;
      const retryPlan = planLegacyOrganizationBackfill({
        userId,
        onboardingData: params.onboardingData,
        automationBusinessName: params.automationBusinessName,
        existingOrganization: org,
        existingMembership: membership,
        organizationMembershipCount: count,
      });

      if (
        retryPlan.action === 'already_mapped' &&
        retryPlan.membershipAction === 'already_present' &&
        retryPlan.membershipId
      ) {
        return {
          organizationId: retryPlan.organizationId,
          membershipId: retryPlan.membershipId,
          createdOrganization: false,
          createdMembership: false,
        };
      }

      throw new TenantLifecycleError(
        'unique_constraint_race',
        'Concurrent tenant creation conflict; retry failed closed'
      );
    }
    throw error;
  }
}

/** Pure helper for tests / diagnostics: expected slug for a new User. */
export function previewLegacyOrganizationSlug(params: {
  userId: string;
  onboardingData?: unknown;
  automationBusinessName?: string | null;
}): { organizationId: string; name: string; slug: string } {
  const organizationId = buildLegacyOrganizationId(params.userId);
  const nameResolution = resolveLegacyOrganizationName({
    userId: params.userId,
    onboardingData: params.onboardingData,
    automationBusinessName: params.automationBusinessName,
  });
  const slug = buildLegacyOrganizationSlug({
    userId: params.userId,
    displayName: nameResolution.name,
    nameSource: nameResolution.source,
  });
  return { organizationId, name: nameResolution.name, slug };
}
