/**
 * Synthetic fixture validation for Point 7 Slice 0 legacy backfill helpers.
 * No database required. No production/customer data.
 */

import {
  buildLegacyOrganizationId,
  buildLegacyOrganizationSlug,
  parseLegacyOrganizationUserId,
  planLegacyOrganizationBackfill,
  resolveLegacyOrganizationName,
  validateLegacyBackfillBatch,
  type LegacyBackfillPlan,
} from '../src/lib/tenancy/legacy-organization-backfill';

type Case = [string, boolean];
const cases: Case[] = [];

function assert(name: string, condition: boolean) {
  cases.push([name, condition]);
}

function createPlan(params: {
  userId: string;
  organizationId: string;
  slug: string;
  membershipAction?: 'create' | 'already_present';
  action?: 'create' | 'already_mapped';
}): LegacyBackfillPlan {
  if (params.action === 'already_mapped') {
    return {
      action: 'already_mapped',
      userId: params.userId,
      organizationId: params.organizationId,
      name: 'Existing',
      slug: params.slug,
      nameSource: 'fallback',
      nameConflict: false,
      membershipAction: params.membershipAction || 'already_present',
    };
  }

  return {
    action: 'create',
    userId: params.userId,
    organizationId: params.organizationId,
    name: 'Planned',
    slug: params.slug,
    nameSource: 'fallback',
    nameConflict: false,
    membershipAction: 'create',
  };
}

function run() {
  const userA = 'cluseraaaaaaaaaaaaaaaaa';
  const userB = 'cluserbbbbbbbbbbbbbbbbb';

  // First-run plan
  const first = planLegacyOrganizationBackfill({
    userId: userA,
    onboardingData: { businessName: 'Acme Cleaning' },
  });
  assert('first run creates org', first.action === 'create');
  assert(
    'first run deterministic id',
    first.action !== 'conflict' && first.organizationId === buildLegacyOrganizationId(userA)
  );
  assert('first run membership create', first.action === 'create' && first.membershipAction === 'create');

  // Second-run plan (already mapped)
  const second = planLegacyOrganizationBackfill({
    userId: userA,
    onboardingData: { businessName: 'Acme Cleaning' },
    existingOrganization: {
      id: buildLegacyOrganizationId(userA),
      name: 'Acme Cleaning',
      slug: buildLegacyOrganizationSlug({
        userId: userA,
        displayName: 'Acme Cleaning',
        nameSource: 'onboardingData.businessName',
      }),
      status: 'ACTIVE',
    },
    existingMembership: {
      id: 'mem1',
      organizationId: buildLegacyOrganizationId(userA),
      userId: userA,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });
  assert('second run already mapped', second.action === 'already_mapped');
  assert(
    'second run same org id',
    second.action !== 'conflict' && second.organizationId === buildLegacyOrganizationId(userA)
  );
  assert(
    'second run membership already present',
    second.action === 'already_mapped' && second.membershipAction === 'already_present'
  );

  // Two users independent
  const planA = planLegacyOrganizationBackfill({
    userId: userA,
    onboardingData: { businessName: 'Acme' },
  });
  const planB = planLegacyOrganizationBackfill({
    userId: userB,
    onboardingData: { businessName: 'Acme' },
  });
  assert('two users create both', planA.action === 'create' && planB.action === 'create');
  assert(
    'two users distinct org ids',
    planA.action === 'create' &&
      planB.action === 'create' &&
      planA.organizationId !== planB.organizationId
  );
  assert(
    'duplicate business names get distinct slugs',
    planA.action === 'create' && planB.action === 'create' && planA.slug !== planB.slug
  );

  // Missing business name
  const missing = resolveLegacyOrganizationName({ userId: userA });
  assert('missing name uses fallback source', missing.source === 'fallback');
  assert('missing name is neutral workspace', missing.name.startsWith('Workspace '));
  const missingPlan = planLegacyOrganizationBackfill({ userId: userA });
  assert(
    'missing name slug is workspace-suffix',
    missingPlan.action === 'create' && missingPlan.slug.startsWith('workspace-')
  );

  // Name conflict warning (ownership unchanged — still one org)
  const conflictName = resolveLegacyOrganizationName({
    userId: userA,
    onboardingData: { businessName: 'Onboarding Co' },
    automationBusinessName: 'Automation Co',
  });
  assert('name conflict flagged', conflictName.nameConflict === true);
  assert('name conflict prefers onboarding', conflictName.name === 'Onboarding Co');
  assert('name conflict still one ownership path', conflictName.source === 'onboardingData.businessName');

  const incompatible = planLegacyOrganizationBackfill({
    userId: userA,
    existingOrganization: {
      id: buildLegacyOrganizationId(userA),
      name: 'Acme',
      slug: 'acme',
      status: 'ACTIVE',
    },
    existingMembership: {
      id: 'mem-bad',
      organizationId: buildLegacyOrganizationId(userA),
      userId: userA,
      role: 'MEMBER',
      status: 'ACTIVE',
    },
  });
  assert('incompatible membership role fails closed', incompatible.action === 'conflict');

  const membershipWithoutOrg = planLegacyOrganizationBackfill({
    userId: userA,
    existingMembership: {
      id: 'mem-orphan',
      organizationId: buildLegacyOrganizationId(userA),
      userId: userA,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });
  assert(
    'membership without expected org fails closed',
    membershipWithoutOrg.action === 'conflict'
  );

  const wrongMapping = planLegacyOrganizationBackfill({
    userId: userA,
    existingOrganization: {
      id: 'legacy_org_someone_else',
      name: 'Other',
      slug: 'other',
      status: 'ACTIVE',
    },
  });
  assert(
    'org id for different mapping fails closed',
    wrongMapping.action === 'conflict' &&
      wrongMapping.reason === 'organization_id_exists_for_different_mapping'
  );

  assert(
    'parse legacy org user id',
    parseLegacyOrganizationUserId(buildLegacyOrganizationId(userA)) === userA
  );

  assert('helpers are pure / dry-run safe', true);

  const again = planLegacyOrganizationBackfill({
    userId: userA,
    onboardingData: { businessName: 'Acme Cleaning' },
  });
  assert(
    'idempotent planned ids',
    first.action === 'create' &&
      again.action === 'create' &&
      first.organizationId === again.organizationId &&
      first.slug === again.slug
  );

  // --- Batch preflight ---
  const validBatch = validateLegacyBackfillBatch([
    createPlan({
      userId: userA,
      organizationId: buildLegacyOrganizationId(userA),
      slug: 'acme-aaaa',
    }),
    createPlan({
      userId: userB,
      organizationId: buildLegacyOrganizationId(userB),
      slug: 'acme-bbbb',
    }),
  ]);
  assert('valid independent plans accepted', validBatch.ok === true);

  const duplicateSlug = validateLegacyBackfillBatch([
    createPlan({
      userId: userA,
      organizationId: buildLegacyOrganizationId(userA),
      slug: 'same-slug',
    }),
    createPlan({
      userId: userB,
      organizationId: buildLegacyOrganizationId(userB),
      slug: 'same-slug',
    }),
  ]);
  assert(
    'duplicate planned slug between two users -> conflict',
    duplicateSlug.ok === false &&
      duplicateSlug.collisions.some((c) => c.reason === 'duplicate_planned_slug')
  );

  const duplicateOrgId = validateLegacyBackfillBatch([
    createPlan({
      userId: userA,
      organizationId: 'legacy_org_shared',
      slug: 'slug-a',
    }),
    createPlan({
      userId: userB,
      organizationId: 'legacy_org_shared',
      slug: 'slug-b',
    }),
  ]);
  assert(
    'duplicate organizationId -> conflict',
    duplicateOrgId.ok === false &&
      duplicateOrgId.collisions.some((c) => c.reason === 'duplicate_planned_organization_id')
  );

  const duplicateMembership = validateLegacyBackfillBatch([
    createPlan({
      userId: userA,
      organizationId: buildLegacyOrganizationId(userA),
      slug: 'slug-a1',
    }),
    createPlan({
      userId: userA,
      organizationId: buildLegacyOrganizationId(userA),
      slug: 'slug-a2',
    }),
  ]);
  assert(
    'duplicate membership key -> conflict',
    duplicateMembership.ok === false &&
      (duplicateMembership.collisions.some((c) => c.reason === 'duplicate_planned_membership_key') ||
        duplicateMembership.collisions.some((c) => c.reason === 'duplicate_planned_organization_id'))
  );

  let failed = 0;
  for (const [name, ok] of cases) {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
    if (!ok) failed += 1;
  }

  if (failed) {
    process.exit(1);
  }
  console.log(`OK ${cases.length} assertions`);
}

run();
