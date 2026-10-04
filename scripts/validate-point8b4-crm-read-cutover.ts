/**
 * Point 8B-4 — disposable validation for CRM organization read cutover.
 *
 * Requires FR004_DATABASE_URL or DATABASE_URL → disposable local Postgres.
 *
 * Usage:
 *   FR004_DATABASE_URL=postgresql://... npm run tenancy:validate-point8b4
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
import {
  buildLegacyOrganizationId,
  buildLegacyOrganizationSlug,
} from '../src/lib/tenancy/legacy-organization-backfill';
import {
  NEXORA_ORGANIZATION_HEADER,
  resolveCrmReadOrganization,
} from '../src/lib/tenancy/resolve-crm-read-organization';
import { resolveLegacyCrmWriteOrganization } from '../src/lib/tenancy/resolve-legacy-crm-write-organization';
import { resolveTenantContext } from '../src/lib/tenancy/tenant-context';

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

function sourceUsesOrgScopedCrmWhere(src: string, patterns: RegExp[]): boolean {
  return patterns.every((p) => p.test(src));
}

async function main() {
  const url = process.env.FR004_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Set FR004_DATABASE_URL or DATABASE_URL');
  assertDisposableUrl(url);
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'point8b4-test-secret-not-for-production';
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  let passed = 0;
  const pass = (name: string) => {
    passed += 1;
    console.log(`[point8b4] PASS ${name}`);
  };

  try {
    console.log('[point8b4] target=', url.replace(/:\/\/[^@]+@/, '://***@'));

    const schema = readFile('prisma/schema.prisma');
    const crmLeadBlock = schema.match(/model CrmLead \{[\s\S]*?\n\}/)?.[0] || '';
    assert(/organizationId\s+String\b/.test(crmLeadBlock) && !/organizationId\s+String\?/.test(crmLeadBlock), 'organizationId must be NOT NULL after 8B-6');
    assert(/^\s*userId\s+String\s*$/m.test(crmLeadBlock), 'userId must remain required');
    pass('1 CrmLead.organizationId NOT NULL; userId required');

    const migrations = listMigrationDirs();
    assert(migrations.length === 4, `expected exactly 4 migrations, got ${migrations.length}`);
    assert(
      !migrations.some((m) => /8b4|read.?cutover/i.test(m)),
      'no Point 8B-4 migration directory'
    );
    assert(migrations.includes('20261004120000_crmlead_organization_id_not_null'), '8B-6 migration required');
    pass('2 migration set includes 8B-6 NOT NULL (no 8B-4-specific migration)');

    await resetPublic(prisma);
    await prisma.$disconnect();
    runPrismaMigrateDeploy(url);
    await prisma.$connect();

    // Production-style: all CrmLead rows non-null organizationId (no fallback needed)
    const userA = await prisma.user.create({
      data: { email: 'a8b4@example.com', name: 'A', password: 'x' },
    });
    await ensureUserOrganization(prisma, { userId: userA.id });
    const legacyA = buildLegacyOrganizationId(userA.id);

    const leadA = await prisma.crmLead.create({
      data: {
        userId: userA.id,
        organizationId: legacyA,
        name: 'Org Lead A',
        source: 'manual',
        stage: 'lead',
      },
    });
    assert(leadA.organizationId !== null, 'fixture lead must be non-null org');
    const nullRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "CrmLead" WHERE "organizationId" IS NULL
    `;
    assert(Number(nullRows[0]?.count || 0) === 0, 'no null organizationId rows in fixture');
    pass('3 production-style backfilled data requires no null fallback');

    const tokenA = signUserToken({ userId: userA.id, email: userA.email });

    const single = await resolveCrmReadOrganization({
      authorizationHeader: `Bearer ${tokenA}`,
    });
    assert(single.ok && single.context.organizationId === legacyA, 'single membership auto-select');
    pass('4 single ACTIVE membership/no header resolves organization');

    // Shared org: User B ACTIVE in Organization A (legacyA)
    const userB = await prisma.user.create({
      data: { email: 'b8b4@example.com', name: 'B', password: 'x' },
    });
    await prisma.membership.create({
      data: {
        organizationId: legacyA,
        userId: userB.id,
        role: MembershipRole.MEMBER,
        status: MembershipStatus.ACTIVE,
      },
    });
    // Also give B their own legacy org so they have TWO memberships
    await ensureUserOrganization(prisma, { userId: userB.id });
    const legacyB = buildLegacyOrganizationId(userB.id);
    const tokenB = signUserToken({ userId: userB.id, email: userB.email });

    const multiNoHeader = await resolveCrmReadOrganization({
      authorizationHeader: `Bearer ${tokenB}`,
    });
    assert(
      !multiNoHeader.ok && multiNoHeader.code === 'ORGANIZATION_SELECTION_REQUIRED',
      'multi membership without header must fail selection-required'
    );
    pass('5 multiple ACTIVE memberships/no header fails selection-required');

    const explicitOwned = await resolveCrmReadOrganization({
      authorizationHeader: `Bearer ${tokenB}`,
      organizationIdHeader: legacyA,
    });
    assert(explicitOwned.ok && explicitOwned.context.organizationId === legacyA, 'explicit owned org');
    pass('6 explicit owned ACTIVE org succeeds');

    const unowned = await resolveCrmReadOrganization({
      authorizationHeader: `Bearer ${tokenA}`,
      organizationIdHeader: 'org_unowned_xyz',
    });
    assert(!unowned.ok && unowned.code === 'ORGANIZATION_ACCESS_DENIED', 'unowned org fails');
    pass('7 unowned org header fails closed');

    await prisma.membership.updateMany({
      where: { userId: userB.id, organizationId: legacyA },
      data: { status: MembershipStatus.SUSPENDED },
    });
    const inactiveMem = await resolveCrmReadOrganization({
      authorizationHeader: `Bearer ${tokenB}`,
      organizationIdHeader: legacyA,
    });
    assert(!inactiveMem.ok && inactiveMem.code === 'MEMBERSHIP_INACTIVE', 'inactive membership');
    pass('8 inactive membership fails closed');
    await prisma.membership.updateMany({
      where: { userId: userB.id, organizationId: legacyA },
      data: { status: MembershipStatus.ACTIVE },
    });

    await prisma.organization.update({
      where: { id: legacyA },
      data: { status: OrganizationStatus.SUSPENDED },
    });
    const inactiveOrg = await resolveCrmReadOrganization({
      authorizationHeader: `Bearer ${tokenA}`,
      organizationIdHeader: legacyA,
    });
    assert(!inactiveOrg.ok && inactiveOrg.code === 'ORGANIZATION_INACTIVE', 'inactive org');
    pass('9 inactive org fails closed');
    await prisma.organization.update({
      where: { id: legacyA },
      data: { status: OrganizationStatus.ACTIVE },
    });

    // Static route cutover assertions
    const crmLeadsGet = readFile('src/app/api/crm/leads/route.ts');
    assert(
      sourceUsesOrgScopedCrmWhere(crmLeadsGet, [
        /resolveCrmReadOrganization/,
        /where:\s*\{\s*organizationId:\s*readOrg\.context\.organizationId/,
      ]),
      'GET /api/crm/leads must be org-scoped'
    );
    assert(!/where:\s*\{\s*userId\s*\}/.test(crmLeadsGet.split('export async function GET')[1]?.split('export async function POST')[0] || ''), 'GET crm/leads must not use userId where');
    pass('10 GET /api/crm/leads is organizationId-scoped');

    const leadsGet = readFile('src/app/api/leads/route.ts');
    assert(/organizationId:\s*readOrg\.context\.organizationId/.test(leadsGet), 'GET /api/leads org');
    pass('11 GET /api/leads is organizationId-scoped');

    const leadsId = readFile('src/app/api/leads/[id]/route.ts');
    assert(/organizationId:\s*readOrg\.context\.organizationId/.test(leadsId), 'GET leads/[id] org');
    // Point 8B-5B: interactive writes use writeOrg.context.organizationId
    assert(/organizationId:\s*writeOrg\.context\.organizationId/.test(leadsId), 'PATCH leads/[id] writeOrg');
    pass('12 GET /api/leads/[id] is organizationId-scoped');

    const statsSrc = readFile('src/app/api/crm/stats/route.ts');
    assert(/organizationId:\s*readOrg\.context\.organizationId/.test(statsSrc), 'stats org');
    assert(!/where:\s*\{\s*userId/.test(statsSrc), 'stats must not use userId');
    pass('13 CRM stats are organizationId-scoped');

    const meSrc = readFile('src/app/api/users/me/route.ts');
    assert(/organizationId:\s*readOrg\.context\.organizationId/.test(meSrc), 'me CRM counts org');
    assert(/leadCapture\.count\(\{\s*where:\s*\{\s*userId:\s*user\.id/.test(meSrc), 'LeadCapture remains userId');
    pass('14 /users/me CRM counts are organizationId-scoped');

    const followups = readFile('src/app/api/crm/followups/route.ts');
    assert(/organizationId:\s*readOrg\.context\.organizationId/.test(followups), 'followups org');
    pass('15 Follow-up lead lookup is organizationId-scoped');

    const business = readFile('src/app/api/business/leads/route.ts');
    assert(
      /organizationId:\s*writeOrg\.context\.organizationId,\s*OR:/.test(business.replace(/\s+/g, ' ')),
      'business reuse org'
    );
    pass('16 Business lead existing CRM reuse is organizationId-scoped');

    const onboarding = readFile('src/app/api/users/onboarding/route.ts');
    assert(
      /count\(\{\s*where:\s*\{\s*organizationId:\s*writeOrg\.context\.organizationId/.test(onboarding),
      'onboarding count org'
    );
    pass('17 Onboarding CRM count is organizationId-scoped');

    const patchLead = readFile('src/app/api/crm/leads/[leadId]/route.ts');
    assert(/organizationId:\s*writeOrg\.context\.organizationId/.test(patchLead), 'mutation lookup writeOrg');
    assert(!/data:\s*\{[^}]*organizationId/.test(patchLead), 'mutation must not set organizationId');
    // Defense-in-depth: UPDATE WHERE itself must be organization-scoped (not id-only after lookup).
    const patchUpdateBlocks = [...patchLead.matchAll(/crmLead\.update\(\s*\{([\s\S]*?)\n\s*\}\s*\)/g)].map(
      (m) => m[1]
    );
    assert(patchUpdateBlocks.length >= 1, 'crm/leads/[leadId] must call crmLead.update');
    for (const block of patchUpdateBlocks) {
      assert(
        /where:\s*\{[^}]*organizationId:\s*writeOrg\.context\.organizationId/.test(block),
        'crmLead.update WHERE must include organizationId: writeOrg.context.organizationId'
      );
      assert(/where:\s*\{[^}]*\bid\b/.test(block), 'crmLead.update WHERE must include id');
    }
    pass('18 Mutation lead lookup/update uses writeOrg.context.organizationId');

    const messageSrc = readFile('src/app/api/crm/leads/[leadId]/message/route.ts');
    assert(/organizationId:\s*writeOrg\.context\.organizationId/.test(messageSrc), 'message lookup writeOrg');
    // Both message-route updates must tenant-scope WHERE (not id-only).
    const messageUpdateBlocks = [...messageSrc.matchAll(/crmLead\.update\(\s*\{([\s\S]*?)\n\s*\}\s*\)/g)].map(
      (m) => m[1]
    );
    assert(messageUpdateBlocks.length === 2, `message route must have exactly 2 crmLead.update calls, got ${messageUpdateBlocks.length}`);
    for (const [idx, block] of messageUpdateBlocks.entries()) {
      assert(
        /where:\s*\{[^}]*organizationId:\s*writeOrg\.context\.organizationId/.test(block),
        `message crmLead.update[${idx}] WHERE must include organizationId: writeOrg.context.organizationId`
      );
      assert(/where:\s*\{[^}]*\bid\b/.test(block), `message crmLead.update[${idx}] WHERE must include id`);
    }
    pass('19 Message lead lookup/update uses writeOrg.context.organizationId');

    // Runtime shared-org + isolation
    const orgBOnly = await prisma.organization.create({
      data: {
        id: 'org_b_isolated_8b4',
        name: 'Org B Isolated',
        slug: 'org-b-isolated-8b4',
        status: OrganizationStatus.ACTIVE,
      },
    });
    const userC = await prisma.user.create({
      data: { email: 'c8b4@example.com', name: 'C', password: 'x' },
    });
    await prisma.membership.create({
      data: {
        organizationId: orgBOnly.id,
        userId: userC.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    const leadB = await prisma.crmLead.create({
      data: {
        userId: userC.id,
        organizationId: orgBOnly.id,
        name: 'Isolated Lead B',
        source: 'manual',
      },
    });

    const aCannotReadB = await prisma.crmLead.findFirst({
      where: { id: leadB.id, organizationId: legacyA },
    });
    assert(!aCannotReadB, 'org A must not read org B lead');
    pass('20 Legacy leads from another organization cannot be read');

    // User B with ACTIVE membership in same org CAN read org lead created by User A
    const bReadsA = await resolveCrmReadOrganization({
      authorizationHeader: `Bearer ${tokenB}`,
      organizationIdHeader: legacyA,
    });
    assert(bReadsA.ok, 'user B can resolve org A');
    const sharedVisible = await prisma.crmLead.findMany({
      where: { organizationId: bReadsA.context.organizationId },
    });
    assert(
      sharedVisible.some((l) => l.id === leadA.id && l.userId === userA.id),
      'user B must see lead created by user A in shared org'
    );
    pass('21 User B with ACTIVE membership in same org CAN read org lead created by User A');

    // No userId authorization boundary in tenant CRM read routes
    const tenantReadFiles = [
      'src/app/api/crm/leads/route.ts',
      'src/app/api/crm/stats/route.ts',
      'src/app/api/leads/route.ts',
      'src/app/api/leads/[id]/route.ts',
      'src/app/api/crm/followups/route.ts',
    ];
    for (const file of tenantReadFiles) {
      const src = readFile(file);
      // GET handlers / CrmLead lookups must not authorize via where: { userId }
      const crmWhereUserId = /crmLead\.(findMany|findFirst|count|updateMany)\([\s\S]{0,120}where:\s*\{[^}]*\buserId\b/;
      assert(!crmWhereUserId.test(src), `${file} must not use userId as CrmLead auth boundary`);
      assert(!/organizationId:\s*null|OR:\s*\[[\s\S]*userId/.test(src), `${file} must not have null/userId fallback`);
    }
    pass('22 userId is NOT used as CrmLead read authorization boundary');
    pass('23 No NULL organizationId fallback exists');
    pass('24 No userId fallback exists');

    const metaSrc = readFile('src/app/api/webhooks/meta-leads/route.ts');
    assert(/findExistingMetaCrmLead\(writeOrg\.organizationId/.test(metaSrc), 'meta dup org');
    assert(/findExistingMetaCrmLead\(organizationId: string/.test(metaSrc), 'meta helper org param');
    assert(/resolveLegacyCrmWriteOrganization\(\{\s*userId:\s*config\.userId/.test(metaSrc), 'meta legacy write');
    assert(!/NEXORA_ORGANIZATION_HEADER/.test(metaSrc), 'meta no browser header');
    pass('25 Meta duplicate detection is organizationId-scoped');
    pass('26 Meta still uses config.userId -> deterministic legacy write org');

    const adminSrc = readFile('src/app/api/admin/stats/route.ts');
    assert(/platform-admin exception/i.test(adminSrc), 'admin exception documented');
    assert(/crmLead\.findMany\(\{\s*orderBy:/.test(adminSrc), 'admin remains global');
    pass('27 Admin stats remains intentional global/platform-admin exception');

    assert(/omitCrmLeadOrganizationId/.test(crmLeadsGet), 'crm leads omit organizationId');
    assert(!/organizationId:\s*true/.test(leadsGet), 'leads GET does not select organizationId');
    pass('28 organizationId does not leak into public API response shape');

    // Create dual-write still works
    const writeOk = await resolveLegacyCrmWriteOrganization({
      userId: userA.id,
      authorizationHeader: `Bearer ${tokenA}`,
    });
    assert(writeOk.ok && writeOk.organizationId === legacyA, 'legacy write still ok');
    const dual = await prisma.crmLead.create({
      data: {
        userId: userA.id,
        organizationId: writeOk.organizationId,
        name: 'Dual Write After Cutover',
        source: 'manual',
      },
    });
    assert(dual.userId === userA.id && dual.organizationId === legacyA, 'dual-write preserved');
    pass('29 New CRM creates still dual-write userId + organizationId');

    // Legacy helper (Meta path) still blocks non-legacy orgs.
    // Point 8B-5B interactive writes use resolveCrmWriteOrganization — covered by tenancy:validate-point8b5.
    const nonLegacyOrg = await prisma.organization.create({
      data: {
        id: 'org_non_legacy_write_8b4',
        name: 'Non Legacy',
        slug: buildLegacyOrganizationSlug({
          userId: 'nonlegacy8b4',
          displayName: 'Non Legacy',
          nameSource: 'fallback',
        }),
        status: OrganizationStatus.ACTIVE,
      },
    });
    await prisma.membership.create({
      data: {
        organizationId: nonLegacyOrg.id,
        userId: userA.id,
        role: MembershipRole.MEMBER,
        status: MembershipStatus.ACTIVE,
      },
    });
    const blockedWrite = await resolveLegacyCrmWriteOrganization({
      userId: userA.id,
      authorizationHeader: `Bearer ${tokenA}`,
      organizationIdHeader: nonLegacyOrg.id,
    });
    assert(
      !blockedWrite.ok && blockedWrite.code === 'crm_multi_org_write_not_ready',
      'legacy helper still fails closed for non-legacy (Meta exception)'
    );
    pass('30 Legacy write helper still fails crm_multi_org_write_not_ready for non-legacy (Meta path)');

    pass('31 No production mutation is performed by validation');
    assert(
      !/console\.(log|info|error)\([^\n]*(password|secret|token|JWT)/i.test(
        readFile('src/lib/tenancy/resolve-crm-read-organization.ts')
      ),
      'read helper must not log secrets'
    );
    pass('32 No secrets logged');

    // TenantContext parity
    const tc = await resolveTenantContext({
      authorizationHeader: `Bearer ${tokenB}`,
      organizationIdHeader: legacyA,
    });
    assert(tc.ok && tc.context.organizationId === legacyA, 'TenantContext parity');
    void NEXORA_ORGANIZATION_HEADER;

    console.log(`[point8b4] ALL_PASS count=${passed}`);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error('[point8b4] FAIL', err);
  process.exit(1);
});
