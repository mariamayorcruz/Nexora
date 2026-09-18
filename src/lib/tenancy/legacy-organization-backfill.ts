/**
 * Point 7 Slice 0 — pure helpers for deterministic legacy Organization mapping.
 *
 * Mapping (User-as-tenant transitional):
 *   User.id -> Organization.id = legacy_org_<userId>
 *            -> Membership OWNER/ACTIVE
 *
 * Ownership NEVER depends on company name. Name/slug are display/URL metadata only.
 * Runtime APIs remain userId-scoped until later slices.
 */

export const LEGACY_ORG_ID_PREFIX = 'legacy_org_';

export type LegacyNameSource = 'onboardingData.businessName' | 'tenantAutomationConfig.businessName' | 'fallback';

export type LegacyNameResolution = {
  name: string;
  source: LegacyNameSource;
  /** True when onboarding and automation business names both exist and differ. */
  nameConflict: boolean;
  onboardingBusinessName: string | null;
  automationBusinessName: string | null;
};

export function buildLegacyOrganizationId(userId: string): string {
  const id = String(userId || '').trim();
  if (!id) {
    throw new Error('userId is required for legacy organization id');
  }
  return `${LEGACY_ORG_ID_PREFIX}${id}`;
}

export function parseLegacyOrganizationUserId(organizationId: string): string | null {
  const value = String(organizationId || '').trim();
  if (!value.startsWith(LEGACY_ORG_ID_PREFIX)) return null;
  const userId = value.slice(LEGACY_ORG_ID_PREFIX.length);
  return userId || null;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function extractOnboardingBusinessName(onboardingData: unknown): string | null {
  if (!onboardingData || typeof onboardingData !== 'object' || Array.isArray(onboardingData)) {
    return null;
  }
  return asTrimmedString((onboardingData as Record<string, unknown>).businessName);
}

/**
 * Display name precedence (does not affect ownership):
 * 1. User.onboardingData.businessName
 * 2. TenantAutomationConfig.businessName
 * 3. Neutral fallback Workspace <stable-short-user-id>
 */
export function resolveLegacyOrganizationName(params: {
  userId: string;
  onboardingData?: unknown;
  automationBusinessName?: string | null;
}): LegacyNameResolution {
  const onboardingBusinessName = extractOnboardingBusinessName(params.onboardingData);
  const automationBusinessName = asTrimmedString(params.automationBusinessName);

  const nameConflict = Boolean(
    onboardingBusinessName &&
      automationBusinessName &&
      onboardingBusinessName.toLowerCase() !== automationBusinessName.toLowerCase()
  );

  if (onboardingBusinessName) {
    return {
      name: onboardingBusinessName,
      source: 'onboardingData.businessName',
      nameConflict,
      onboardingBusinessName,
      automationBusinessName,
    };
  }

  if (automationBusinessName) {
    return {
      name: automationBusinessName,
      source: 'tenantAutomationConfig.businessName',
      nameConflict: false,
      onboardingBusinessName,
      automationBusinessName,
    };
  }

  const short = String(params.userId).replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'workspace';
  return {
    name: `Workspace ${short}`,
    source: 'fallback',
    nameConflict: false,
    onboardingBusinessName,
    automationBusinessName,
  };
}

export function slugifySegment(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48);
}

/**
 * Deterministic unique slug. Always includes a stable user-derived suffix so
 * identical business names never collide across Users.
 */
export function buildLegacyOrganizationSlug(params: {
  userId: string;
  displayName: string;
  nameSource: LegacyNameSource;
}): string {
  const suffix = String(params.userId)
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-12)
    .toLowerCase() || 'user';

  if (params.nameSource === 'fallback') {
    return `workspace-${suffix}`;
  }

  const base = slugifySegment(params.displayName) || 'workspace';
  return `${base}-${suffix}`;
}

export type ExistingOrganizationSnapshot = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type ExistingMembershipSnapshot = {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  status: string;
};

export type LegacyBackfillPlan =
  | {
      action: 'create';
      userId: string;
      organizationId: string;
      name: string;
      slug: string;
      nameSource: LegacyNameSource;
      nameConflict: boolean;
      membershipAction: 'create';
    }
  | {
      action: 'already_mapped';
      userId: string;
      organizationId: string;
      name: string;
      slug: string;
      nameSource: LegacyNameSource;
      nameConflict: boolean;
      membershipAction: 'create' | 'already_present';
      membershipId?: string;
    }
  | {
      action: 'conflict';
      userId: string;
      organizationId: string;
      reason: string;
    };

export type BatchCollision = {
  reason:
    | 'duplicate_planned_organization_id'
    | 'duplicate_planned_slug'
    | 'duplicate_planned_membership_key';
  key: string;
  userIds: string[];
};

export type BatchPreflightResult =
  | { ok: true }
  | { ok: false; collisions: BatchCollision[] };

function membershipKey(organizationId: string, userId: string) {
  return `${organizationId}::${userId}`;
}

/**
 * Pure in-batch collision detection for planned creates.
 * Detects duplicate organizationId / slug / membership keys among NEW writes
 * before any transaction starts.
 */
export function validateLegacyBackfillBatch(plans: LegacyBackfillPlan[]): BatchPreflightResult {
  const orgIdOwners = new Map<string, string[]>();
  const slugOwners = new Map<string, string[]>();
  const membershipOwners = new Map<string, string[]>();

  for (const plan of plans) {
    if (plan.action === 'conflict') {
      continue;
    }

    if (plan.action === 'create') {
      const orgOwners = orgIdOwners.get(plan.organizationId) || [];
      orgOwners.push(plan.userId);
      orgIdOwners.set(plan.organizationId, orgOwners);

      const slugList = slugOwners.get(plan.slug) || [];
      slugList.push(plan.userId);
      slugOwners.set(plan.slug, slugList);
    }

    if (plan.membershipAction === 'create') {
      const key = membershipKey(plan.organizationId, plan.userId);
      const owners = membershipOwners.get(key) || [];
      owners.push(plan.userId);
      membershipOwners.set(key, owners);
    }
  }

  const collisions: BatchCollision[] = [];

  for (const [organizationId, userIds] of orgIdOwners.entries()) {
    if (userIds.length > 1) {
      collisions.push({
        reason: 'duplicate_planned_organization_id',
        key: organizationId,
        userIds: Array.from(new Set(userIds)),
      });
    }
  }

  for (const [slug, userIds] of slugOwners.entries()) {
    if (userIds.length > 1) {
      collisions.push({
        reason: 'duplicate_planned_slug',
        key: slug,
        userIds: Array.from(new Set(userIds)),
      });
    }
  }

  for (const [key, userIds] of membershipOwners.entries()) {
    if (userIds.length > 1) {
      collisions.push({
        reason: 'duplicate_planned_membership_key',
        key,
        userIds: Array.from(new Set(userIds)),
      });
    }
  }

  if (collisions.length > 0) {
    return { ok: false, collisions };
  }

  return { ok: true };
}

/**
 * Plan one User → legacy Organization → OWNER Membership without writing.
 * Fail-closed on incompatible existing rows.
 */
export function planLegacyOrganizationBackfill(params: {
  userId: string;
  onboardingData?: unknown;
  automationBusinessName?: string | null;
  existingOrganization?: ExistingOrganizationSnapshot | null;
  existingMembership?: ExistingMembershipSnapshot | null;
}): LegacyBackfillPlan {
  const userId = String(params.userId || '').trim();
  if (!userId) {
    return {
      action: 'conflict',
      userId: '',
      organizationId: '',
      reason: 'missing_user_id',
    };
  }

  const organizationId = buildLegacyOrganizationId(userId);
  const nameResolution = resolveLegacyOrganizationName({
    userId,
    onboardingData: params.onboardingData,
    automationBusinessName: params.automationBusinessName,
  });
  const slug = buildLegacyOrganizationSlug({
    userId,
    displayName: nameResolution.name,
    nameSource: nameResolution.source,
  });

  const existingOrg = params.existingOrganization || null;
  if (existingOrg) {
    const mappedUserId = parseLegacyOrganizationUserId(existingOrg.id);
    if (mappedUserId !== userId) {
      return {
        action: 'conflict',
        userId,
        organizationId,
        reason: 'organization_id_exists_for_different_mapping',
      };
    }

    // Idempotent path: org exists with expected deterministic id.
    // Do not rewrite name/slug/status on re-run (display drift is allowed to remain).
    const existingMembership = params.existingMembership || null;
    if (existingMembership) {
      if (existingMembership.organizationId !== organizationId || existingMembership.userId !== userId) {
        return {
          action: 'conflict',
          userId,
          organizationId,
          reason: 'membership_points_to_unexpected_ids',
        };
      }
      if (existingMembership.role !== 'OWNER' || existingMembership.status !== 'ACTIVE') {
        return {
          action: 'conflict',
          userId,
          organizationId,
          reason: 'existing_membership_role_or_status_incompatible',
        };
      }
      return {
        action: 'already_mapped',
        userId,
        organizationId,
        name: existingOrg.name,
        slug: existingOrg.slug,
        nameSource: nameResolution.source,
        nameConflict: nameResolution.nameConflict,
        membershipAction: 'already_present',
        membershipId: existingMembership.id,
      };
    }

    return {
      action: 'already_mapped',
      userId,
      organizationId,
      name: existingOrg.name,
      slug: existingOrg.slug,
      nameSource: nameResolution.source,
      nameConflict: nameResolution.nameConflict,
      membershipAction: 'create',
    };
  }

  if (params.existingMembership) {
    return {
      action: 'conflict',
      userId,
      organizationId,
      reason: 'membership_exists_without_expected_organization',
    };
  }

  return {
    action: 'create',
    userId,
    organizationId,
    name: nameResolution.name,
    slug,
    nameSource: nameResolution.source,
    nameConflict: nameResolution.nameConflict,
    membershipAction: 'create',
  };
}
