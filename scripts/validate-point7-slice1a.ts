/**
 * Point 7 Slice 1A — disposable validation for TenantContext + lifecycle.
 *
 * Requires FR004_DATABASE_URL or DATABASE_URL pointing at disposable local Postgres.
 * Refuses hosted/production-looking hosts (reuse FR-004 heuristic).
 *
 * Usage:
 *   FR004_DATABASE_URL=postgresql://... npm run tenancy:validate-slice1a
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  MembershipRole,
  MembershipStatus,
  OrganizationStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { signUserToken } from '../src/lib/jwt';
import {
  ensureUserOrganization,
  mapEnsureWriteError,
  TenantLifecycleError,
} from '../src/lib/tenancy/ensure-user-organization';
import {
  buildLegacyOrganizationId,
  buildLegacyOrganizationSlug,
  resolveLegacyOrganizationName,
} from '../src/lib/tenancy/legacy-organization-backfill';
import {
  NEXORA_ORGANIZATION_HEADER,
  resolveTenantContext,
} from '../src/lib/tenancy/tenant-context';

function assertDisposableUrl(url: string) {
  const host = new URL(url.replace(/^postgresql:/i, 'http:').replace(/^postgres:/i, 'http:'))
    .hostname.toLowerCase();
  const blocked = ['supabase.co', 'neon.tech', 'railway.app', 'amazonaws.com'];
  if (blocked.some((b) => host.includes(b)) || host.includes('prod')) {
    throw new Error('Refusing non-disposable database host');
  }
  if (!['localhost', '127.0.0.1', '::1', 'postgres'].includes(host) && !host.endsWith('.local')) {
    throw new Error(`Host ${host} is not an allowed disposable target`);
  }
}

function runPrismaMigrateDeploy(databaseUrl: string) {
  const bin = path.join(process.cwd(), 'node_modules', '.bin', 'prisma');
  execFileSync(bin, ['migrate', 'deploy'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function resetPublic(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE');
  await prisma.$executeRawUnsafe('CREATE SCHEMA public');
}

async function main() {
  const url = process.env.FR004_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Set FR004_DATABASE_URL or DATABASE_URL');
  assertDisposableUrl(url);
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'slice1a-test-secret-not-for-production';
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  let passed = 0;
  const pass = (name: string) => {
    passed += 1;
    console.log(`[slice1a] PASS ${name}`);
  };

  try {
    console.log('[slice1a] resetting disposable schema + migrate deploy');
    await resetPublic(prisma);
    await prisma.$disconnect();
    runPrismaMigrateDeploy(url);
    await prisma.$connect();

    // --- Lifecycle tests ---
    const userA = await prisma.user.create({
      data: { email: 'a@example.com', name: 'A', password: 'x' },
    });
    const first = await ensureUserOrganization(prisma, { userId: userA.id });
    assert(first.createdOrganization && first.createdMembership, 'first ensure should create');
    pass('10 new user -> organization + owner membership');

    const second = await ensureUserOrganization(prisma, { userId: userA.id });
    assert(!second.createdOrganization && !second.createdMembership, 'rerun idempotent');
    assert(second.membershipId === first.membershipId, 'same membership id');
    pass('11 rerun -> idempotent');

    const userC = await prisma.user.create({
      data: { email: 'c@example.com', name: 'C', password: 'x' },
    });
    const orgC = buildLegacyOrganizationId(userC.id);
    const nameC = resolveLegacyOrganizationName({ userId: userC.id });
    const slugC = buildLegacyOrganizationSlug({
      userId: userC.id,
      displayName: nameC.name,
      nameSource: nameC.source,
    });
    await prisma.organization.create({
      data: { id: orgC, name: nameC.name, slug: slugC, status: OrganizationStatus.ACTIVE },
    });
    await prisma.membership.create({
      data: {
        organizationId: orgC,
        userId: userC.id,
        role: MembershipRole.MEMBER,
        status: MembershipStatus.ACTIVE,
      },
    });
    try {
      await ensureUserOrganization(prisma, { userId: userC.id });
      throw new Error('expected fail for incompatible role');
    } catch (e) {
      assert(e instanceof TenantLifecycleError, 'TenantLifecycleError');
      assert(e.code === 'existing_membership_role_or_status_incompatible', e.code);
    }
    pass('13 incompatible role/status -> fail');

    // 12: pure planner invariant (NOT ensureUserOrganization DB integration).
    // ensureUserOrganization always looks up by buildLegacyOrganizationId(userId), so a
    // mismatched org id is not reachable via the helper's DB path; the planner still
    // fail-closes if ever handed such a snapshot.
    const { planLegacyOrganizationBackfill } = await import(
      '../src/lib/tenancy/legacy-organization-backfill'
    );
    const mismatch = planLegacyOrganizationBackfill({
      userId: 'user-y',
      existingOrganization: {
        id: buildLegacyOrganizationId('user-x'),
        name: 'X',
        slug: 'x',
        status: 'ACTIVE',
      },
    });
    assert(mismatch.action === 'conflict', 'mismatch conflict');
    assert(
      mismatch.action === 'conflict' &&
        mismatch.reason === 'organization_id_exists_for_different_mapping',
      'mismatch reason'
    );
    pass('12 pure planner invariant — mismatched deterministic organization snapshot fails');

    // 14 slug collision
    const userE = await prisma.user.create({
      data: { email: 'e@example.com', name: 'E', password: 'x' },
    });
    const previewE = resolveLegacyOrganizationName({ userId: userE.id });
    const slugE = buildLegacyOrganizationSlug({
      userId: userE.id,
      displayName: previewE.name,
      nameSource: previewE.source,
    });
    await prisma.organization.create({
      data: {
        id: 'other-org-slug-collision',
        name: 'Other',
        slug: slugE,
        status: OrganizationStatus.ACTIVE,
      },
    });
    try {
      await ensureUserOrganization(prisma, { userId: userE.id });
      throw new Error('expected slug collision fail');
    } catch (e) {
      assert(e instanceof TenantLifecycleError, 'TenantLifecycleError slug');
      assert(e.code === 'slug_owned_by_different_organization', e.code);
    }
    pass('14 slug collision -> fail');

    // 15 empty deterministic org -> create owner membership
    const userF = await prisma.user.create({
      data: { email: 'f@example.com', name: 'F', password: 'x' },
    });
    const orgF = buildLegacyOrganizationId(userF.id);
    const nameF = resolveLegacyOrganizationName({ userId: userF.id });
    const slugF = buildLegacyOrganizationSlug({
      userId: userF.id,
      displayName: nameF.name,
      nameSource: nameF.source,
    });
    await prisma.organization.create({
      data: { id: orgF, name: nameF.name, slug: `${slugF}-empty`, status: OrganizationStatus.ACTIVE },
    });
    const ensureF = await ensureUserOrganization(prisma, { userId: userF.id });
    assert(!ensureF.createdOrganization && ensureF.createdMembership, 'membership only');
    pass('15 existing empty deterministic Organization -> create owner membership');

    // 16 org has foreign membership without expected owner
    const userG = await prisma.user.create({
      data: { email: 'g@example.com', name: 'G', password: 'x' },
    });
    const userH = await prisma.user.create({
      data: { email: 'h@example.com', name: 'H', password: 'x' },
    });
    const orgG = buildLegacyOrganizationId(userG.id);
    const nameG = resolveLegacyOrganizationName({ userId: userG.id });
    const slugG = buildLegacyOrganizationSlug({
      userId: userG.id,
      displayName: nameG.name,
      nameSource: nameG.source,
    });
    await prisma.organization.create({
      data: { id: orgG, name: nameG.name, slug: `${slugG}-foreign`, status: OrganizationStatus.ACTIVE },
    });
    await prisma.membership.create({
      data: {
        organizationId: orgG,
        userId: userH.id,
        role: MembershipRole.MEMBER,
        status: MembershipStatus.ACTIVE,
      },
    });
    try {
      await ensureUserOrganization(prisma, { userId: userG.id });
      throw new Error('expected foreign membership fail');
    } catch (e) {
      assert(e instanceof TenantLifecycleError, 'TenantLifecycleError foreign');
      assert(e.code === 'organization_has_memberships_but_expected_owner_missing', e.code);
    }
    pass('16 foreign membership without expected owner -> fail closed');

    // 17 slug-collision fail closed inside txn: rolls back User (pre-write TenantLifecycleError)
    const boomUserEmail = 'boom@example.com';
    try {
      await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { email: boomUserEmail, name: 'Boom', password: 'x' },
        });
        const preview = resolveLegacyOrganizationName({ userId: created.id });
        const slug = buildLegacyOrganizationSlug({
          userId: created.id,
          displayName: preview.name,
          nameSource: preview.source,
        });
        await tx.organization.create({
          data: {
            id: 'collider-org',
            name: 'Collider',
            slug,
            status: OrganizationStatus.ACTIVE,
          },
        });
        await ensureUserOrganization(tx, { userId: created.id });
      });
      throw new Error('expected transaction failure');
    } catch (e) {
      assert(e instanceof TenantLifecycleError, 'atomicity TenantLifecycleError');
      assert(e.code === 'slug_owned_by_different_organization', e.code);
    }
    const leaked = await prisma.user.findUnique({ where: { email: boomUserEmail } });
    assert(!leaked, 'user must not remain after failed tenant txn');
    pass('17 tenant creation failure must not leave partial User');

    // 18 SUSPENDED deterministic org + OWNER/ACTIVE membership -> ensure fails (no writes/reactivation)
    const userSuspOrg = await prisma.user.create({
      data: { email: 'lifecyclesusp@example.com', name: 'LS', password: 'x' },
    });
    const orgSuspLife = buildLegacyOrganizationId(userSuspOrg.id);
    await prisma.organization.create({
      data: {
        id: orgSuspLife,
        name: 'Suspended Life',
        slug: 'lifecycle-susp-org',
        status: OrganizationStatus.SUSPENDED,
      },
    });
    const memSuspLife = await prisma.membership.create({
      data: {
        organizationId: orgSuspLife,
        userId: userSuspOrg.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    try {
      await ensureUserOrganization(prisma, { userId: userSuspOrg.id });
      throw new Error('expected suspended org lifecycle fail');
    } catch (e) {
      assert(e instanceof TenantLifecycleError, 'TenantLifecycleError suspended org');
      assert(e.code === 'organization_inactive', e.code);
    }
    const orgSuspAfter = await prisma.organization.findUnique({ where: { id: orgSuspLife } });
    const memSuspAfter = await prisma.membership.findUnique({ where: { id: memSuspLife.id } });
    assert(orgSuspAfter?.status === OrganizationStatus.SUSPENDED, 'org not reactivated');
    assert(
      memSuspAfter?.role === MembershipRole.OWNER && memSuspAfter?.status === MembershipStatus.ACTIVE,
      'membership not rewritten'
    );
    pass('18 Organization SUSPENDED + OWNER/ACTIVE Membership -> lifecycle ensure fails');

    // 19 DEACTIVATED deterministic org + OWNER/ACTIVE membership -> ensure fails
    const userDeactOrg = await prisma.user.create({
      data: { email: 'lifecycledeact@example.com', name: 'LD', password: 'x' },
    });
    const orgDeactLife = buildLegacyOrganizationId(userDeactOrg.id);
    await prisma.organization.create({
      data: {
        id: orgDeactLife,
        name: 'Deactivated Life',
        slug: 'lifecycle-deact-org',
        status: OrganizationStatus.DEACTIVATED,
      },
    });
    const memDeactLife = await prisma.membership.create({
      data: {
        organizationId: orgDeactLife,
        userId: userDeactOrg.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    try {
      await ensureUserOrganization(prisma, { userId: userDeactOrg.id });
      throw new Error('expected deactivated org lifecycle fail');
    } catch (e) {
      assert(e instanceof TenantLifecycleError, 'TenantLifecycleError deactivated org');
      assert(e.code === 'organization_inactive', e.code);
    }
    const orgDeactAfter = await prisma.organization.findUnique({ where: { id: orgDeactLife } });
    const memDeactAfter = await prisma.membership.findUnique({ where: { id: memDeactLife.id } });
    assert(orgDeactAfter?.status === OrganizationStatus.DEACTIVATED, 'org not reactivated');
    assert(
      memDeactAfter?.role === MembershipRole.OWNER &&
        memDeactAfter?.status === MembershipStatus.ACTIVE,
      'membership not rewritten'
    );
    pass('19 Organization DEACTIVATED + OWNER/ACTIVE Membership -> lifecycle ensure fails');

    // 20 DB concurrency race-safety (does NOT claim deterministic P2002 observation).
    // Concurrent ensures on the same user must leave exactly one Organization and one Membership.
    // If a loser hits P2002, it may reject with unique_constraint_race — but fulfilled=2/rejected=0
    // is also a valid serial execution and still passes this invariant.
    const raceEmail = 'p2002race@example.com';
    const raceUser = await prisma.user.create({
      data: { email: raceEmail, name: 'Race', password: 'x' },
    });
    const raceOrgId = buildLegacyOrganizationId(raceUser.id);
    const raceResults = await Promise.allSettled([
      prisma.$transaction((tx) => ensureUserOrganization(tx, { userId: raceUser.id })),
      prisma.$transaction((tx) => ensureUserOrganization(tx, { userId: raceUser.id })),
    ]);
    const fulfilled = raceResults.filter((r) => r.status === 'fulfilled');
    const rejected = raceResults.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    assert(fulfilled.length >= 1, 'at least one concurrent ensure succeeds');
    for (const r of rejected) {
      const reason = r.reason;
      assert(reason instanceof TenantLifecycleError, 'rejected ensure is TenantLifecycleError');
      assert(
        reason.code === 'unique_constraint_race',
        `if rejected, expected unique_constraint_race got ${reason.code}`
      );
    }
    const raceOrgs = await prisma.organization.findMany({ where: { id: raceOrgId } });
    const raceMems = await prisma.membership.findMany({
      where: { organizationId: raceOrgId, userId: raceUser.id },
    });
    assert(raceOrgs.length === 1, 'exactly one Organization after concurrent ensures');
    assert(raceMems.length === 1, 'exactly one Membership after concurrent ensures');
    pass(
      '20 concurrent ensure race-safety — exactly one Organization and one Membership (P2002 not required)'
    );

    // 21 Unit-level error mapping: Prisma P2002 → TenantLifecycleError('unique_constraint_race')
    // This is what proveably covers the mapping branch; it does not require a DB race.
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['id'] },
    });
    const mappedP2002 = mapEnsureWriteError(p2002);
    assert(mappedP2002 instanceof TenantLifecycleError, 'P2002 maps to TenantLifecycleError');
    assert(mappedP2002!.code === 'unique_constraint_race', mappedP2002!.code);
    const mappedOther = mapEnsureWriteError(new Error('not unique'));
    assert(mappedOther === null, 'non-P2002 errors are not remapped');
    const mappedLifecycle = mapEnsureWriteError(
      new TenantLifecycleError('organization_inactive', 'x')
    );
    assert(
      mappedLifecycle instanceof TenantLifecycleError &&
        mappedLifecycle.code === 'organization_inactive',
      'TenantLifecycleError passthrough'
    );
    pass('21 unit mapEnsureWriteError — P2002 → unique_constraint_race');

    // --- TenantContext selection tests ---
    const auth = (userId: string, email: string) =>
      `Bearer ${signUserToken({ userId, email })}`;

    // Prepare dedicated users for context tests
    const u1 = await prisma.user.create({
      data: { email: 'ctx1@example.com', name: 'Ctx1', password: 'x' },
    });
    await ensureUserOrganization(prisma, { userId: u1.id });

    let r = await resolveTenantContext({
      authorizationHeader: auth(u1.id, u1.email),
      db: prisma,
    });
    assert(r.ok && r.context.organizationId === buildLegacyOrganizationId(u1.id), 'one membership');
    pass('1 one ACTIVE membership -> success');

    const u0 = await prisma.user.create({
      data: { email: 'ctx0@example.com', name: 'Ctx0', password: 'x' },
    });
    r = await resolveTenantContext({
      authorizationHeader: auth(u0.id, u0.email),
      db: prisma,
    });
    assert(!r.ok && r.code === 'NO_ACTIVE_MEMBERSHIP', 'zero membership');
    pass('2 zero membership -> denied');

    const u2 = await prisma.user.create({
      data: { email: 'ctx2@example.com', name: 'Ctx2', password: 'x' },
    });
    await ensureUserOrganization(prisma, { userId: u2.id });
    const secondOrg = await prisma.organization.create({
      data: {
        id: 'second-org-u2',
        name: 'Second',
        slug: 'second-org-u2',
        status: OrganizationStatus.ACTIVE,
      },
    });
    await prisma.membership.create({
      data: {
        organizationId: secondOrg.id,
        userId: u2.id,
        role: MembershipRole.MEMBER,
        status: MembershipStatus.ACTIVE,
      },
    });
    r = await resolveTenantContext({
      authorizationHeader: auth(u2.id, u2.email),
      db: prisma,
    });
    assert(!r.ok && r.code === 'ORGANIZATION_SELECTION_REQUIRED', 'multi');
    pass('3 two ACTIVE memberships without explicit org -> selection required');

    r = await resolveTenantContext({
      authorizationHeader: auth(u2.id, u2.email),
      organizationIdHeader: secondOrg.id,
      db: prisma,
    });
    assert(r.ok && r.context.organizationId === secondOrg.id, 'explicit valid');
    pass('4 explicit valid org -> success');

    r = await resolveTenantContext({
      authorizationHeader: auth(u2.id, u2.email),
      organizationIdHeader: buildLegacyOrganizationId(u1.id),
      db: prisma,
    });
    assert(!r.ok && r.code === 'ORGANIZATION_ACCESS_DENIED', 'foreign org');
    pass('5 explicit foreign org -> denied');

    const uSuspMem = await prisma.user.create({
      data: { email: 'suspmem@example.com', name: 'SM', password: 'x' },
    });
    const orgSm = await prisma.organization.create({
      data: {
        id: buildLegacyOrganizationId(uSuspMem.id),
        name: 'SM',
        slug: 'sm-org',
        status: OrganizationStatus.ACTIVE,
      },
    });
    await prisma.membership.create({
      data: {
        organizationId: orgSm.id,
        userId: uSuspMem.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.SUSPENDED,
      },
    });
    r = await resolveTenantContext({
      authorizationHeader: auth(uSuspMem.id, uSuspMem.email),
      db: prisma,
    });
    assert(!r.ok && r.code === 'NO_ACTIVE_MEMBERSHIP', 'suspended membership');
    pass('6 suspended membership -> denied');

    const uRem = await prisma.user.create({
      data: { email: 'removed@example.com', name: 'RM', password: 'x' },
    });
    const orgRm = await prisma.organization.create({
      data: {
        id: buildLegacyOrganizationId(uRem.id),
        name: 'RM',
        slug: 'rm-org',
        status: OrganizationStatus.ACTIVE,
      },
    });
    await prisma.membership.create({
      data: {
        organizationId: orgRm.id,
        userId: uRem.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.REMOVED,
      },
    });
    r = await resolveTenantContext({
      authorizationHeader: auth(uRem.id, uRem.email),
      organizationIdHeader: orgRm.id,
      db: prisma,
    });
    assert(!r.ok && r.code === 'MEMBERSHIP_INACTIVE', 'removed membership');
    pass('7 removed membership -> denied');

    const uOrgSusp = await prisma.user.create({
      data: { email: 'orgsusp@example.com', name: 'OS', password: 'x' },
    });
    const orgSusp = await prisma.organization.create({
      data: {
        id: buildLegacyOrganizationId(uOrgSusp.id),
        name: 'OS',
        slug: 'os-org',
        status: OrganizationStatus.SUSPENDED,
      },
    });
    await prisma.membership.create({
      data: {
        organizationId: orgSusp.id,
        userId: uOrgSusp.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    r = await resolveTenantContext({
      authorizationHeader: auth(uOrgSusp.id, uOrgSusp.email),
      organizationIdHeader: orgSusp.id,
      db: prisma,
    });
    assert(!r.ok && r.code === 'ORGANIZATION_INACTIVE', 'suspended org');
    pass('8 suspended organization -> denied');

    const uOrgDeact = await prisma.user.create({
      data: { email: 'orgdeact@example.com', name: 'OD', password: 'x' },
    });
    const orgDeact = await prisma.organization.create({
      data: {
        id: buildLegacyOrganizationId(uOrgDeact.id),
        name: 'OD',
        slug: 'od-org',
        status: OrganizationStatus.DEACTIVATED,
      },
    });
    await prisma.membership.create({
      data: {
        organizationId: orgDeact.id,
        userId: uOrgDeact.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    r = await resolveTenantContext({
      authorizationHeader: auth(uOrgDeact.id, uOrgDeact.email),
      db: prisma,
    });
    assert(!r.ok && r.code === 'NO_ACTIVE_MEMBERSHIP', 'deactivated org');
    pass('9 deactivated organization -> denied');

    // Header constant sanity
    assert(NEXORA_ORGANIZATION_HEADER === 'x-nexora-organization-id', 'header name');

    console.log(`[slice1a] ALL_PASS count=${passed}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[slice1a] FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
});
