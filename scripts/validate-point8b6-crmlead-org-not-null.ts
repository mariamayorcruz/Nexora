/**
 * Point 8B-6 — disposable validation for CrmLead.organizationId NOT NULL hardening.
 *
 * Expects the active prisma migration + schema NOT NULL to be present.
 * Proves on disposable DB that SET NOT NULL is enforced, CREATE paths stamp org id,
 * and fail-closed behavior holds when nulls are reintroduced only for regression.
 *
 * Usage:
 *   FR004_DATABASE_URL=postgresql://... npm run tenancy:validate-point8b6
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
import { ensureUserOrganization } from '../src/lib/tenancy/ensure-user-organization';
import { buildLegacyOrganizationId } from '../src/lib/tenancy/legacy-organization-backfill';
import {
  NEXORA_ORGANIZATION_HEADER,
  resolveLegacyCrmWriteOrganization,
} from '../src/lib/tenancy/resolve-legacy-crm-write-organization';
import { resolveCrmWriteOrganization } from '../src/lib/tenancy/resolve-crm-write-organization';
import { resolveCrmReadOrganization } from '../src/lib/tenancy/resolve-crm-read-organization';
import { signUserToken } from '../src/lib/jwt';
import {
  collectPoint8b6PreflightCounts,
  evaluatePoint8b6PreflightGates,
  simulateDisposableLegacyOrgBackfill,
} from './preflight-point8b6-crmlead-org-not-null';

const PROPOSED_SQL_REL =
  'docs/migrations/20261003120000_crmlead_organization_id_not_null.proposed.sql';
const ACTIVE_MIGRATION_SQL_REL =
  'prisma/migrations/20261004120000_crmlead_organization_id_not_null/migration.sql';
const ACTIVE_MIGRATION_NAME = '20261004120000_crmlead_organization_id_not_null';

const RUNTIME_CREATE_FILES = [
  'src/app/api/crm/leads/route.ts',
  'src/app/api/leads/route.ts',
  'src/app/api/business/leads/route.ts',
  'src/app/api/users/onboarding/route.ts',
  'src/app/api/webhooks/meta-leads/route.ts',
] as const;

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

function columnNullable(url: string, table: string, column: string): boolean {
  const out = execFileSync(
    'psql',
    [
      url,
      '-v',
      'ON_ERROR_STOP=1',
      '-tAc',
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_schema='public' AND table_name='${table}' AND column_name='${column}'`,
    ],
    { encoding: 'utf8' }
  ).trim();
  return out === 'YES';
}

async function main() {
  const url = process.env.FR004_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Set FR004_DATABASE_URL or DATABASE_URL');
  assertDisposableUrl(url);
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'point8b6-test-secret-not-for-production';
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  let passed = 0;
  const pass = (name: string) => {
    passed += 1;
    console.log(`[point8b6] PASS ${name}`);
  };

  try {
    console.log('[point8b6] target=', url.replace(/:\/\/[^@]+@/, '://***@'));

    // --- Static design artifacts (activated) ---
    assert(fs.existsSync(path.join(process.cwd(), ACTIVE_MIGRATION_SQL_REL)), 'active 8B-6 migration missing');
    assert(fs.existsSync(path.join(process.cwd(), PROPOSED_SQL_REL)), 'proposed SQL reference missing');
    const activeSql = readFile(ACTIVE_MIGRATION_SQL_REL);
    assert(/ALTER TABLE "CrmLead"/i.test(activeSql), 'active SQL must alter CrmLead');
    assert(
      /ALTER COLUMN "organizationId" SET NOT NULL/i.test(activeSql),
      'active SQL must SET NOT NULL on organizationId'
    );
    assert(!/DROP COLUMN "userId"/i.test(activeSql), 'must not drop userId');
    const executableSql = activeSql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    assert(
      !/ALTER TABLE "(LeadCapture|Campaign|AdAccount|tenant_automation_configs)"/i.test(executableSql),
      'must not alter other models'
    );
    assert(!/ENABLE ROW LEVEL SECURITY|CREATE POLICY/i.test(executableSql), 'no RLS');
    assert(
      (executableSql.match(/ALTER TABLE/gi) || []).length === 1,
      'exactly one ALTER TABLE statement'
    );
    pass('1 active migration SQL is minimal NOT NULL hardening');

    const migrations = listMigrationDirs();
    assert(migrations.length === 4, `active prisma/migrations must be 4 including 8B-6 (got ${migrations.length})`);
    assert(migrations.includes(ACTIVE_MIGRATION_NAME), '8B-6 migration must be active in prisma/migrations');
    pass('2 8B-6 migration activated in prisma/migrations');

    const schema = readFile('prisma/schema.prisma');
    const crmLeadBlock = schema.match(/model CrmLead \{[\s\S]*?\n\}/)?.[0] || '';
    assert(
      /organizationId\s+String\b/.test(crmLeadBlock) && !/organizationId\s+String\?/.test(crmLeadBlock),
      'active schema organizationId must be required String'
    );
    assert(/organization\s+Organization\s+@relation/.test(crmLeadBlock), 'organization relation required');
    assert(/^\s*userId\s+String\s*$/m.test(crmLeadBlock), 'userId remains required');
    assert(/onDelete:\s*Restrict/.test(crmLeadBlock), 'FK Restrict retained');
    pass('3 active Prisma schema organizationId NOT NULL (userId retained)');

    // --- Static CREATE path audit ---
    for (const file of RUNTIME_CREATE_FILES) {
      const src = readFile(file);
      assert(/crmLead\.create\(/.test(src), `${file} must create CrmLead`);
      assert(/organizationId:\s*/.test(src), `${file} must set organizationId`);
      assert(!/organizationId:\s*(body|payload|input)/.test(src), `${file} must not trust body.organizationId`);
    }
    pass('4 all five runtime CREATE files stamp organizationId');

    const interactiveFiles = RUNTIME_CREATE_FILES.filter((f) => !f.includes('meta-leads'));
    for (const file of interactiveFiles) {
      const src = readFile(file);
      assert(/resolveCrmWriteOrganization/.test(src), `${file} uses trusted write TenantContext`);
      assert(!/resolveLegacyCrmWriteOrganization/.test(src), `${file} must not use Meta legacy helper`);
    }
    pass('5 interactive CREATE paths use resolveCrmWriteOrganization');

    const metaSrc = readFile('src/app/api/webhooks/meta-leads/route.ts');
    assert(/resolveLegacyCrmWriteOrganization\s*\(/.test(metaSrc), 'Meta calls legacy helper');
    assert(
      !/^import[\s\S]*?resolveCrmWriteOrganization[\s\S]*?from/m.test(metaSrc) &&
        !/await\s+resolveCrmWriteOrganization\s*\(/.test(metaSrc),
      'Meta must not import/call interactive write resolver'
    );
    assert(/config\.userId/.test(metaSrc), 'Meta provenance remains config.userId');
    pass('6 Meta CREATE path keeps approved legacy mapping');

    // No other runtime crmLead.create under src/
    const createHits = execFileSync(
      'rg',
      ['-n', 'crmLead\\.create\\s*\\(', 'src', '--glob', '*.ts'],
      { encoding: 'utf8', cwd: process.cwd() }
    )
      .trim()
      .split('\n')
      .filter(Boolean);
    for (const hit of createHits) {
      assert(
        RUNTIME_CREATE_FILES.some((f) => hit.includes(f)),
        `unexpected runtime CREATE path: ${hit}`
      );
    }
    assert(createHits.length === RUNTIME_CREATE_FILES.length, `expected ${RUNTIME_CREATE_FILES.length} CREATE hits, got ${createHits.length}`);
    pass('7 no undiscovered runtime CrmLead CREATE paths');

    // body.organizationId never assigned into create data
    for (const file of RUNTIME_CREATE_FILES) {
      const src = readFile(file);
      assert(
        !/organizationId:\s*body\.organizationId/.test(src) &&
          !/organizationId:\s*.*body\[.organizationId/.test(src),
        `${file} must ignore body.organizationId`
      );
    }
    pass('8 no CREATE path trusts body.organizationId');

    // Read / mutation org scoping still present
    assert(/organizationId:\s*readOrg\.context\.organizationId/.test(readFile('src/app/api/crm/leads/route.ts')), 'CRM GET org-scoped');
    assert(/resolveCrmWriteOrganization/.test(readFile('src/app/api/crm/leads/[leadId]/route.ts')), 'CRM PATCH write-guarded');
    assert(/resolveCrmWriteOrganization/.test(readFile('src/app/api/crm/leads/[leadId]/message/route.ts')), 'CRM message write-guarded');
    assert(/resolveCrmReadOrganization/.test(readFile('src/app/api/crm/followups/route.ts')), 'followups read-guarded');
    assert(/resolveCrmReadOrganization/.test(readFile('src/app/api/users/me/route.ts')), 'users/me CRM metrics org-scoped');
    assert(/findExistingMetaCrmLead/.test(metaSrc) && /organizationId/.test(metaSrc), 'Meta duplicate detection org-scoped');
    const adminStats = readFile('src/app/api/admin/stats/route.ts');
    assert(/crmLead\.findMany/.test(adminStats), 'admin stats still aggregates CrmLead');
    assert(!/where:\s*\{[^}]*organizationId/.test(adminStats), 'admin stats remains intentional global exception');
    pass('9 reads/mutations/admin exception compatible with future NOT NULL');

    // --- Disposable DB lifecycle ---
    await resetPublic(prisma);
    await prisma.$disconnect();
    runPrismaMigrateDeploy(url);
    await prisma.$connect();
    assert(!columnNullable(url, 'CrmLead', 'organizationId'), 'migrate deploy must apply 8B-6 NOT NULL');
    pass('10 disposable migrate deploy applies organizationId NOT NULL');

    const user = await prisma.user.create({
      data: { email: 'crm8b6@example.com', name: 'CRM8B6', password: 'x' },
    });
    await ensureUserOrganization(prisma, { userId: user.id });
    const legacyId = buildLegacyOrganizationId(user.id);
    const token = signUserToken({ userId: user.id, email: user.email, sid: 'sid-8b6' });

    // Regression window: reopen nullability only on disposable to prove fail-closed SET NOT NULL.
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "CrmLead" ALTER COLUMN "organizationId" DROP NOT NULL'
    );
    assert(columnNullable(url, 'CrmLead', 'organizationId'), 'disposable DROP NOT NULL for regression');

    // Historical null (pre-8B-3 shape) — raw insert bypasses Prisma NOT NULL client typing
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CrmLead" (id, "userId", "organizationId", name, source, stage, status, value, confidence, "createdAt", "updatedAt")
       VALUES ($1, $2, NULL, $3, 'manual', 'lead', 'nuevo', 0, 25, NOW(), NOW())`,
      `cl_hist_${user.id.slice(-8)}`,
      user.id,
      'HISTORICAL NULL'
    );
    // Dual-written modern lead
    await prisma.crmLead.create({
      data: {
        userId: user.id,
        organizationId: legacyId,
        name: 'MODERN DUAL WRITE',
        source: 'manual',
      },
    });

    const preBackfill = await collectPoint8b6PreflightCounts(prisma);
    assert(preBackfill.nullOrganizationId === 1, 'preflight must detect historical null');
    const preGate = evaluatePoint8b6PreflightGates(preBackfill);
    assert(!preGate.pass, 'preflight must FAIL while nulls remain');
    pass('11 preflight FAIL-CLOSED when null organizationId remains (8B-3 incomplete)');

    // Applying NOT NULL before backfill must fail
    let notNullRejected = false;
    try {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "CrmLead" ALTER COLUMN "organizationId" SET NOT NULL'
      );
    } catch {
      notNullRejected = true;
    }
    assert(notNullRejected, 'SET NOT NULL must fail while nulls exist');
    assert(columnNullable(url, 'CrmLead', 'organizationId'), 'column still nullable after failed SET NOT NULL');
    pass('12 SET NOT NULL rejected while null rows exist');

    // Simulate Point 8B-3 on disposable only
    const backfilled = await simulateDisposableLegacyOrgBackfill(prisma);
    assert(backfilled === 1, `expected 1 simulated backfill, got ${backfilled}`);
    const postBackfill = await collectPoint8b6PreflightCounts(prisma);
    const postGate = evaluatePoint8b6PreflightGates(postBackfill);
    assert(postGate.pass, `post-backfill preflight must PASS: ${postGate.failures.join('; ')}`);
    assert(postBackfill.nullOrganizationId === 0, 'zero nulls after simulated backfill');
    pass('13 simulated 8B-3 backfill yields preflight PASS (zero null / valid ownership)');

    // Re-apply NOT NULL SQL on disposable after backfill
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "CrmLead" ALTER COLUMN "organizationId" SET NOT NULL'
    );
    assert(!columnNullable(url, 'CrmLead', 'organizationId'), 'organizationId must be NOT NULL after apply');
    pass('14 disposable re-apply of SET NOT NULL succeeds after backfill');

    // Null insert must fail
    let nullInsertFailed = false;
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "CrmLead" (id, "userId", name, source, stage, status, value, confidence, "createdAt", "updatedAt")
         VALUES ('cl_null_should_fail', '${user.id.replace(/'/g, "''")}', 'NO ORG', 'manual', 'lead', 'nuevo', 0, 25, NOW(), NOW())`
      );
    } catch {
      nullInsertFailed = true;
    }
    assert(nullInsertFailed, 'INSERT without organizationId must fail under NOT NULL');
    pass('15 CREATE without organizationId fails closed at DB after hardening');

    // Interactive write still works with TenantContext
    const write = await resolveCrmWriteOrganization({
      authorizationHeader: `Bearer ${token}`,
      organizationIdHeader: legacyId,
    });
    assert(write.ok, 'interactive write org resolves');
    if (write.ok) {
      const created = await prisma.crmLead.create({
        data: {
          userId: write.context.userId,
          organizationId: write.context.organizationId,
          name: 'POST NOT NULL CREATE',
          source: 'manual',
        },
      });
      assert(created.organizationId === legacyId, 'created lead has organizationId');
      assert(created.userId === user.id, 'userId remains actor/provenance');
    }
    pass('16 interactive TenantContext create works under NOT NULL');

    // body.organizationId spoof ignored at resolver layer (unowned)
    const foreign = await prisma.organization.create({
      data: {
        id: 'org_8b6_foreign',
        name: 'Foreign',
        slug: 'org-8b6-foreign',
        status: OrganizationStatus.ACTIVE,
      },
    });
    const spoof = await resolveCrmWriteOrganization({
      authorizationHeader: `Bearer ${token}`,
      organizationIdHeader: foreign.id,
    });
    assert(!spoof.ok, 'unowned organization header must fail');
    pass('17 unowned organization header cannot authorize writes');

    // Meta legacy path consistency
    const legacy = await resolveLegacyCrmWriteOrganization({ userId: user.id });
    assert(legacy.ok && legacy.organizationId === legacyId, 'Meta legacy mapping intact');
    pass('18 Meta legacy write mapping remains consistent');

    // Read isolation still holds
    const otherUser = await prisma.user.create({
      data: { email: 'crm8b6-b@example.com', name: 'B', password: 'x' },
    });
    await ensureUserOrganization(prisma, { userId: otherUser.id });
    const otherLegacy = buildLegacyOrganizationId(otherUser.id);
    await prisma.crmLead.create({
      data: {
        userId: otherUser.id,
        organizationId: otherLegacy,
        name: 'OTHER ORG LEAD',
        source: 'manual',
      },
    });
    const readA = await resolveCrmReadOrganization({
      authorizationHeader: `Bearer ${token}`,
      organizationIdHeader: legacyId,
    });
    assert(readA.ok, 'read org A ok');
    if (readA.ok) {
      const leadsA = await prisma.crmLead.findMany({
        where: { organizationId: readA.context.organizationId },
      });
      assert(
        leadsA.every((l) => l.organizationId === legacyId),
        'read isolation org A'
      );
      assert(
        !leadsA.some((l) => l.name === 'OTHER ORG LEAD'),
        'no cross-tenant leak'
      );
    }
    pass('19 tenant read isolation regression holds under NOT NULL');

    // Membership for multi-org write still valid
    await prisma.membership.create({
      data: {
        organizationId: foreign.id,
        userId: user.id,
        role: MembershipRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });
    const multi = await resolveCrmWriteOrganization({
      authorizationHeader: `Bearer ${token}`,
      organizationIdHeader: foreign.id,
    });
    assert(multi.ok && multi.ok && multi.context.organizationId === foreign.id, 'multi-org write still works');
    if (multi.ok) {
      const lead = await prisma.crmLead.create({
        data: {
          userId: multi.context.userId,
          organizationId: multi.context.organizationId,
          name: 'MULTI ORG LEAD',
          source: 'manual',
        },
      });
      assert(lead.organizationId === foreign.id, 'multi-org create stamps selected org');
    }
    pass('20 multi-org write create stamps selected TenantContext organizationId');

    // Final preflight on hardened DB
    const finalCounts = await collectPoint8b6PreflightCounts(prisma);
    const finalGate = evaluatePoint8b6PreflightGates(finalCounts);
    assert(finalGate.pass, `final preflight must PASS: ${finalGate.failures.join('; ')}`);
    assert(finalCounts.nullOrganizationId === 0, 'final zero nulls');
    pass('21 final preflight PASS on hardened disposable DB');

    pass('22 no production mutation (disposable only)');
    pass('23 prisma/migrations + schema NOT NULL activation verified on disposable');
    pass('24 zero-null preflight remains a hard gate before SET NOT NULL (8B-3 dependency satisfied)');

    console.log(`[point8b6] ALL_PASS count=${passed}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[point8b6] FAIL', err);
  process.exit(1);
});
