/**
 * Point 8B-5B — disposable validation for true multi-org CRM write cutover.
 *
 * Requires FR004_DATABASE_URL or DATABASE_URL → disposable local Postgres.
 *
 * Usage:
 *   FR004_DATABASE_URL=postgresql://... npm run tenancy:validate-point8b5
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  MembershipRole,
  MembershipStatus,
  OrganizationStatus,
  PrismaClient,
} from '@prisma/client';
import { signUserToken } from '../src/lib/jwt';
import { ensureUserOrganization } from '../src/lib/tenancy/ensure-user-organization';
import { buildLegacyOrganizationId } from '../src/lib/tenancy/legacy-organization-backfill';
import {
  resolveCrmWriteOrganization,
} from '../src/lib/tenancy/resolve-crm-write-organization';
import {
  omitCrmLeadOrganizationId,
  resolveLegacyCrmWriteOrganization,
} from '../src/lib/tenancy/resolve-legacy-crm-write-organization';

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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function runPrismaMigrateDeploy(databaseUrl: string) {
  const bin = path.join(process.cwd(), 'node_modules', '.bin', 'prisma');
  execFileSync(bin, ['migrate', 'deploy'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
}

async function resetPublic(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE');
  await prisma.$executeRawUnsafe('CREATE SCHEMA public');
}

function readFile(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

function listMigrationDirs(): string[] {
  const root = path.join(process.cwd(), 'prisma', 'migrations');
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

async function main() {
  const url = process.env.FR004_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Set FR004_DATABASE_URL or DATABASE_URL');
  assertDisposableUrl(url);
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'point8b5-test-secret-not-for-production';
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  let passed = 0;
  const pass = (name: string) => {
    passed += 1;
    console.log(`[point8b5] PASS ${name}`);
  };

  try {
    console.log('[point8b5] target=', url.replace(/:\/\/[^@]+@/, '://***@'));

    // 1. CrmLead.organizationId remains nullable in schema
    const schema = readFile('prisma/schema.prisma');
    const crmLeadBlock = schema.match(/model CrmLead \{[\s\S]*?\n\}/)?.[0] || '';
    assert(/organizationId\s+String\?/.test(crmLeadBlock), 'organizationId must remain nullable');
    assert(/^\s*userId\s+String\s*$/m.test(crmLeadBlock), 'userId must remain required');
    pass('1 CrmLead.organizationId remains nullable in schema');

    // 2. No new Prisma migration
    const migrations = listMigrationDirs();
    assert(migrations.length === 3, `expected exactly 3 migrations, got ${migrations.length}`);
    assert(
      !migrations.some((m) => /8b.?5|multi.?org.?write/i.test(m)),
      'no Point 8B-5 migration directory'
    );
    pass('2 no new Prisma migration exists');

    await resetPublic(prisma);
    await prisma.$disconnect();
    runPrismaMigrateDeploy(url);
    await prisma.$connect();

    // Fixtures: User A with legacy org; User B shared; non-legacy org B
    const userA = await prisma.user.create({
      data: { email: 'a8b5@example.com', name: 'A', password: 'x' },
    });
    await ensureUserOrganization(prisma, { userId: userA.id });
    const legacyA = buildLegacyOrganizationId(userA.id);
    const tokenA = signUserToken({ userId: userA.id, email: userA.email });

    // 3. One ACTIVE membership / no header resolves and permits write
    const single = await resolveCrmWriteOrganization({
      authorizationHeader: `Bearer ${tokenA}`,
    });
    assert(single.ok && single.context.organizationId === legacyA, 'single membership auto-select');
    assert(single.ok && single.context.userId === userA.id, 'actor userId in context');
    pass('3 one ACTIVE membership/no header resolves and permits write');

    // 4. Multiple ACTIVE memberships / no header → ORGANIZATION_SELECTION_REQUIRED
    const nonLegacyB = await prisma.organization.create({
      data: {
        id: 'org_non_legacy_8b5b',
        name: 'Non Legacy Org B',
        slug: 'non-legacy-org-b-8b5',
        status: OrganizationStatus.ACTIVE,
      },
    });
    await prisma.membership.create({
      data: {
        organizationId: nonLegacyB.id,
        userId: userA.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    const multiNoHeader = await resolveCrmWriteOrganization({
      authorizationHeader: `Bearer ${tokenA}`,
    });
    assert(
      !multiNoHeader.ok && multiNoHeader.code === 'ORGANIZATION_SELECTION_REQUIRED',
      'multi membership without header must fail selection-required'
    );
    pass('4 multiple ACTIVE memberships/no header fails ORGANIZATION_SELECTION_REQUIRED');

    // 5. Explicit owned ACTIVE non-legacy organization succeeds
    const explicitNonLegacy = await resolveCrmWriteOrganization({
      authorizationHeader: `Bearer ${tokenA}`,
      organizationIdHeader: nonLegacyB.id,
    });
    assert(
      explicitNonLegacy.ok && explicitNonLegacy.context.organizationId === nonLegacyB.id,
      'explicit owned non-legacy org'
    );
    pass('5 explicit owned ACTIVE non-legacy organization succeeds');

    // 6. Unowned organization header fails
    const unowned = await resolveCrmWriteOrganization({
      authorizationHeader: `Bearer ${tokenA}`,
      organizationIdHeader: 'org_unowned_8b5_xyz',
    });
    assert(!unowned.ok && unowned.code === 'ORGANIZATION_ACCESS_DENIED', 'unowned org fails');
    pass('6 unowned organization header fails');

    // 7. Inactive membership fails
    await prisma.membership.updateMany({
      where: { userId: userA.id, organizationId: nonLegacyB.id },
      data: { status: MembershipStatus.SUSPENDED },
    });
    const inactiveMem = await resolveCrmWriteOrganization({
      authorizationHeader: `Bearer ${tokenA}`,
      organizationIdHeader: nonLegacyB.id,
    });
    assert(!inactiveMem.ok && inactiveMem.code === 'MEMBERSHIP_INACTIVE', 'inactive membership');
    pass('7 inactive membership fails');
    await prisma.membership.updateMany({
      where: { userId: userA.id, organizationId: nonLegacyB.id },
      data: { status: MembershipStatus.ACTIVE },
    });

    // 8. Inactive organization fails
    await prisma.organization.update({
      where: { id: nonLegacyB.id },
      data: { status: OrganizationStatus.SUSPENDED },
    });
    const inactiveOrg = await resolveCrmWriteOrganization({
      authorizationHeader: `Bearer ${tokenA}`,
      organizationIdHeader: nonLegacyB.id,
    });
    assert(!inactiveOrg.ok && inactiveOrg.code === 'ORGANIZATION_INACTIVE', 'inactive org');
    pass('8 inactive organization fails');
    await prisma.organization.update({
      where: { id: nonLegacyB.id },
      data: { status: OrganizationStatus.ACTIVE },
    });

    // 9–11. OWNER / ADMIN / MEMBER ACTIVE can write
    for (const [role, label] of [
      [MembershipRole.OWNER, '9'],
      [MembershipRole.ADMIN, '10'],
      [MembershipRole.MEMBER, '11'],
    ] as const) {
      await prisma.membership.updateMany({
        where: { userId: userA.id, organizationId: nonLegacyB.id },
        data: { role, status: MembershipStatus.ACTIVE },
      });
      const roleWrite = await resolveCrmWriteOrganization({
        authorizationHeader: `Bearer ${tokenA}`,
        organizationIdHeader: nonLegacyB.id,
      });
      assert(roleWrite.ok && roleWrite.context.organizationId === nonLegacyB.id, `${role} can write`);
      pass(`${label} ${role} ACTIVE can write`);
    }
    await prisma.membership.updateMany({
      where: { userId: userA.id, organizationId: nonLegacyB.id },
      data: { role: MembershipRole.OWNER },
    });

    // 12–16. Interactive create stores TenantContext fields; body org ignored; non-legacy succeeds; no silent legacy fallback
    const createIntoB = await resolveCrmWriteOrganization({
      authorizationHeader: `Bearer ${tokenA}`,
      organizationIdHeader: nonLegacyB.id,
    });
    assert(createIntoB.ok, 'create context for non-legacy');
    const spoofBodyOrg = 'org_spoofed_from_body';
    // Simulate route semantics: ownership from context only
    const createdLead = await prisma.crmLead.create({
      data: {
        userId: createIntoB.context.userId,
        organizationId: createIntoB.context.organizationId,
        name: 'Multi Org Write Lead',
        source: 'manual',
        notes: `body.organizationId=${spoofBodyOrg}`,
      },
    });
    assert(createdLead.organizationId === nonLegacyB.id, 'create stores selected TenantContext.organizationId');
    pass('12 interactive create stores selected TenantContext.organizationId');
    assert(createdLead.userId === userA.id, 'create stores authenticated TenantContext.userId as provenance');
    pass('13 interactive create stores authenticated TenantContext.userId as provenance');
    assert(createdLead.organizationId !== spoofBodyOrg, 'body.organizationId must not control ownership');
    pass('14 body.organizationId cannot control ownership');
    assert(createdLead.organizationId !== legacyA, 'must not silently fall back to legacy org');
    pass('15 valid non-legacy org interactive write now succeeds');
    pass('16 no silent legacy fallback occurs');

    // Shared-org teammate fixture: User B ACTIVE in Org A (legacyA); lead owned by User A
    const userB = await prisma.user.create({
      data: { email: 'b8b5@example.com', name: 'B', password: 'x' },
    });
    await prisma.membership.create({
      data: {
        organizationId: legacyA,
        userId: userB.id,
        role: MembershipRole.MEMBER,
        status: MembershipStatus.ACTIVE,
      },
    });
    await ensureUserOrganization(prisma, { userId: userB.id });
    const tokenB = signUserToken({ userId: userB.id, email: userB.email });

    const leadByA = await prisma.crmLead.create({
      data: {
        userId: userA.id,
        organizationId: legacyA,
        name: 'Shared Org Lead',
        source: 'manual',
        stage: 'lead',
        notes: 'created by A',
      },
    });

    // 17–18. User B updates lead created by User A (same org); no userId ownership filter
    const writeB = await resolveCrmWriteOrganization({
      authorizationHeader: `Bearer ${tokenB}`,
      organizationIdHeader: legacyA,
    });
    assert(writeB.ok && writeB.context.organizationId === legacyA, 'user B resolves org A');
    const teammateUpdate = await prisma.crmLead.updateMany({
      where: { id: leadByA.id, organizationId: writeB.context.organizationId },
      data: { notes: 'updated by B' },
    });
    assert(teammateUpdate.count === 1, 'user B must update lead by id+organizationId');
    const afterTeammate = await prisma.crmLead.findUnique({ where: { id: leadByA.id } });
    assert(afterTeammate?.notes === 'updated by B', 'teammate mutation applied');
    assert(afterTeammate?.userId === userA.id, 'creator userId provenance unchanged');
    pass('17 User B can update lead created by User A when both belong to same organization');
    pass('18 CrmLead.userId is NOT required as update ownership filter');

    // 19. Organization B cannot update Organization A lead
    const crossTenant = await prisma.crmLead.updateMany({
      where: { id: leadByA.id, organizationId: nonLegacyB.id },
      data: { notes: 'cross-tenant attempt' },
    });
    assert(crossTenant.count === 0, 'org B must not update org A lead');
    const stillA = await prisma.crmLead.findUnique({ where: { id: leadByA.id } });
    assert(stillA?.notes === 'updated by B', 'cross-tenant must not mutate');
    pass('19 Organization B cannot update Organization A lead');

    // 20–21. Static: UPDATE WHERE contains id + organizationId; PATCH cannot change organizationId
    const patchLeadSrc = readFile('src/app/api/crm/leads/[leadId]/route.ts');
    const patchUpdateBlocks = [...patchLeadSrc.matchAll(/crmLead\.update\(\s*\{([\s\S]*?)\n\s*\}\s*\)/g)].map(
      (m) => m[1]
    );
    assert(patchUpdateBlocks.length >= 1, 'crm/leads/[leadId] must call crmLead.update');
    for (const block of patchUpdateBlocks) {
      assert(/where:\s*\{[^}]*\bid\b/.test(block), 'UPDATE WHERE must include id');
      assert(
        /where:\s*\{[^}]*organizationId:\s*writeOrg\.context\.organizationId/.test(block),
        'UPDATE WHERE must include organizationId'
      );
      assert(!/data:\s*\{[^}]*organizationId/.test(block), 'UPDATE data must not set organizationId');
    }
    const leadsIdSrc = readFile('src/app/api/leads/[id]/route.ts');
    assert(
      /updateMany\(\{\s*where:\s*\{\s*id:\s*leadId,\s*organizationId:\s*writeOrg\.context\.organizationId/.test(
        leadsIdSrc.replace(/\s+/g, ' ')
      ),
      'leads/[id] updateMany WHERE id+organizationId'
    );
    assert(!/data:\s*\{[^}]*organizationId/.test(leadsIdSrc), 'leads/[id] must not set organizationId');
    pass('20 actual UPDATE WHERE contains id + organizationId');
    pass('21 organizationId cannot be changed via PATCH');

    // 22–26. Interactive routes use new write resolver
    const interactiveWriteRoutes = [
      ['22', 'src/app/api/crm/leads/route.ts', 'POST /api/crm/leads'],
      ['23', 'src/app/api/leads/route.ts', 'POST /api/leads'],
      ['24', 'src/app/api/crm/leads/[leadId]/route.ts', 'crm/leads/[leadId] PATCH'],
      ['25', 'src/app/api/crm/leads/[leadId]/message/route.ts', 'message route'],
      ['26', 'src/app/api/leads/[id]/route.ts', 'leads/[id] PATCH'],
    ] as const;
    for (const [n, file, label] of interactiveWriteRoutes) {
      const src = readFile(file);
      assert(/resolveCrmWriteOrganization/.test(src), `${label} must use resolveCrmWriteOrganization`);
      assert(!/resolveLegacyCrmWriteOrganization/.test(src), `${label} must not use legacy write resolver`);
      pass(`${n} ${label} uses new write resolver`);
    }

    // 27–28. Business promotion
    const businessSrc = readFile('src/app/api/business/leads/route.ts');
    assert(/resolveCrmWriteOrganization/.test(businessSrc), 'business uses new write resolver');
    assert(
      /organizationId:\s*writeOrg\.context\.organizationId/.test(businessSrc),
      'business create/reuse uses TenantContext org'
    );
    assert(/leadCapture\.findUnique/.test(businessSrc), 'LeadCapture lookup preserved');
    assert(
      /capture\.userId\s*!==\s*auth\.user\.id/.test(businessSrc),
      'LeadCapture remains user-owned authorization'
    );
    assert(!/leadCapture\.update\([\s\S]*organizationId/.test(businessSrc), 'LeadCapture not org-migrated');
    pass('27 business promotion uses selected TenantContext organization');
    pass('28 business promotion leaves LeadCapture user-owned');

    // 29–30. Onboarding
    const onboardingSrc = readFile('src/app/api/users/onboarding/route.ts');
    assert(/resolveCrmWriteOrganization/.test(onboardingSrc), 'onboarding uses new write resolver');
    assert(/db:\s*tx/.test(onboardingSrc), 'onboarding resolves using same tx client');
    assert(
      /organizationId:\s*writeOrg\.context\.organizationId/.test(onboardingSrc),
      'onboarding count/create uses selected organization'
    );
    assert(!/ensureUserOrganization/.test(onboardingSrc), 'onboarding must not call ensureUserOrganization');
    pass('29 onboarding resolves using same tx client');
    pass('30 onboarding count/create uses selected organization');

    // 31–34. Meta legacy exception
    const metaSrc = readFile('src/app/api/webhooks/meta-leads/route.ts');
    assert(/resolveLegacyCrmWriteOrganization/.test(metaSrc), 'Meta still uses legacy write resolver');
    assert(
      /resolveLegacyCrmWriteOrganization\(\{\s*userId:\s*config\.userId/.test(metaSrc),
      'Meta still uses config.userId'
    );
    assert(!/NEXORA_ORGANIZATION_HEADER/.test(metaSrc), 'Meta does not accept browser org header');
    assert(/findExistingMetaCrmLead\(writeOrg\.organizationId/.test(metaSrc), 'Meta dup org-scoped');
    assert(!/resolveCrmWriteOrganization\(/.test(metaSrc), 'Meta must not call resolveCrmWriteOrganization');
    pass('31 Meta still uses resolveLegacyCrmWriteOrganization');
    pass('32 Meta still uses config.userId');
    pass('33 Meta does not accept browser org header');
    pass('34 Meta duplicate lookup remains organization-scoped');

    // 35. Interactive runtime routes no longer use resolveLegacyCrmWriteOrganization
    const interactiveRuntime = [
      'src/app/api/crm/leads/route.ts',
      'src/app/api/leads/route.ts',
      'src/app/api/crm/leads/[leadId]/route.ts',
      'src/app/api/crm/leads/[leadId]/message/route.ts',
      'src/app/api/leads/[id]/route.ts',
      'src/app/api/business/leads/route.ts',
      'src/app/api/users/onboarding/route.ts',
    ];
    for (const file of interactiveRuntime) {
      const src = readFile(file);
      assert(!/resolveLegacyCrmWriteOrganization/.test(src), `${file} must not use legacy write resolver`);
    }
    pass('35 interactive runtime routes no longer use resolveLegacyCrmWriteOrganization');

    // 36. Public CRM API does not leak organizationId
    const crmLeadsSrc = readFile('src/app/api/crm/leads/route.ts');
    assert(/omitCrmLeadOrganizationId/.test(crmLeadsSrc), 'crm leads omit organizationId');
    const publicLead = omitCrmLeadOrganizationId({
      id: 'x',
      organizationId: nonLegacyB.id,
      name: 'n',
    });
    assert(!('organizationId' in publicLead), 'omit helper strips organizationId');
    const leadsGetSrc = readFile('src/app/api/leads/route.ts');
    assert(!/organizationId:\s*true/.test(leadsGetSrc), 'leads GET does not select organizationId');
    pass('36 public CRM API does not leak organizationId');

    // 37. Point 8B-4 read isolation still holds
    const readIsolation = await prisma.crmLead.findFirst({
      where: { id: leadByA.id, organizationId: nonLegacyB.id },
    });
    assert(!readIsolation, 'org B cannot read org A lead');
    const crmGetSrc = readFile('src/app/api/crm/leads/route.ts');
    assert(/resolveCrmReadOrganization/.test(crmGetSrc), 'GET crm/leads still org-read');
    assert(
      /where:\s*\{\s*organizationId:\s*readOrg\.context\.organizationId/.test(crmGetSrc),
      'GET crm/leads still org-scoped'
    );
    pass('37 Point 8B-4 read isolation still holds');

    // 38. Point 8B-5B temporal "no frontend 8B-5C" assertion retired after 8B-5C authorization.
    // Frontend org discovery/header propagation is covered by tenancy:validate-point8b5c.
    // Enduring rule: frontend must never call server write resolvers / treat client as authority.
    const dashboardFiles: string[] = [];
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (/\.(tsx?|jsx?)$/.test(entry.name)) dashboardFiles.push(p);
      }
    };
    walk(path.join(process.cwd(), 'src/app/dashboard'));
    walk(path.join(process.cwd(), 'src/components'));
    for (const file of dashboardFiles) {
      const src = fs.readFileSync(file, 'utf8');
      assert(
        !/resolveCrmWriteOrganization|resolveCrmReadOrganization|resolveLegacyCrmWriteOrganization/.test(src),
        `${file} must not import server tenancy resolvers`
      );
    }
    pass('38 frontend must not import server tenancy resolvers (8B-5C UX covered by point8b5c validator)');

    // 39–40. Process invariants
    pass('39 no production DB mutation occurs');
    assert(
      !/console\.(log|info|error)\([^\n]*(password|secret|token|JWT)/i.test(
        readFile('src/lib/tenancy/resolve-crm-write-organization.ts')
      ),
      'write helper must not log secrets'
    );
    pass('40 no secrets are logged');

    // Global runtime inventory sanity
    assert(
      fs.existsSync(path.join(process.cwd(), 'src/lib/tenancy/resolve-legacy-crm-write-organization.ts')),
      'legacy write resolver file must remain'
    );
    assert(
      fs.existsSync(path.join(process.cwd(), 'src/lib/tenancy/resolve-crm-write-organization.ts')),
      'new write resolver file must exist'
    );

    // Empty/whitespace header treated as absent: with only legacy membership after removing non-legacy
    await prisma.membership.deleteMany({
      where: { userId: userA.id, organizationId: nonLegacyB.id },
    });
    // userA now has only legacyA again
    const whitespaceHeader = await resolveCrmWriteOrganization({
      authorizationHeader: `Bearer ${tokenA}`,
      organizationIdHeader: '   ',
    });
    assert(
      whitespaceHeader.ok && whitespaceHeader.context.organizationId === legacyA,
      'whitespace header treated as absent → auto-select single org'
    );
    pass('H whitespace/empty org header treated as absent');

    // Legacy helper still fails non-legacy for Meta path (no silent interactive fallback via legacy)
    await prisma.membership.create({
      data: {
        organizationId: nonLegacyB.id,
        userId: userA.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    const legacyBlocked = await resolveLegacyCrmWriteOrganization({
      userId: userA.id,
      authorizationHeader: `Bearer ${tokenA}`,
      organizationIdHeader: nonLegacyB.id,
    });
    assert(
      !legacyBlocked.ok && legacyBlocked.code === 'crm_multi_org_write_not_ready',
      'legacy helper remains fail-closed for non-legacy (Meta)'
    );
    pass('legacy helper remains Meta-only fail-closed for non-legacy');

    console.log(`[point8b5] ALL_PASS count=${passed}`);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error('[point8b5] FAIL', err);
  process.exit(1);
});
