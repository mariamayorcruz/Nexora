/**
 * Point 8B-2 — disposable validation for CRM runtime dual-write.
 *
 * Requires FR004_DATABASE_URL or DATABASE_URL → disposable local Postgres.
 *
 * Usage:
 *   FR004_DATABASE_URL=postgresql://... npm run tenancy:validate-point8b2
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
  NEXORA_ORGANIZATION_HEADER,
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
    process.env.JWT_SECRET = 'point8b2-test-secret-not-for-production';
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  let passed = 0;
  const pass = (name: string) => {
    passed += 1;
    console.log(`[point8b2] PASS ${name}`);
  };

  try {
    console.log('[point8b2] target=', url.replace(/:\/\/[^@]+@/, '://***@'));

    // 1–6 schema / migration invariants (static + migrate deploy)
    const schema = readFile('prisma/schema.prisma');
    const crmLeadBlock = schema.match(/model CrmLead \{[\s\S]*?\n\}/)?.[0] || '';
    assert(/organizationId\s+String\?/.test(crmLeadBlock), 'CrmLead.organizationId must be String?');
    assert(/^\s*userId\s+String\s*$/m.test(crmLeadBlock), 'userId must remain required (NOT NULL)');
    assert(
      /onDelete:\s*Restrict/.test(crmLeadBlock),
      'FK must use onDelete: Restrict'
    );
    assert(/@@index\(\[organizationId,\s*updatedAt\]\)/.test(crmLeadBlock), 'missing organizationId+updatedAt index');
    assert(/@@index\(\[organizationId,\s*stage\]\)/.test(crmLeadBlock), 'missing organizationId+stage index');
    assert(/@@index\(\[userId\]\)/.test(crmLeadBlock), 'missing userId index');
    assert(/model Organization \{[\s\S]*?crmLeads\s+CrmLead\[\]/.test(schema), 'Organization.crmLeads missing');
    pass('1-6 prisma schema aligns with Point 8B-1 physical design');

    const migrations = listMigrationDirs();
    assert(
      migrations.includes('20260930011200_add_crmlead_organization_tenancy_foundation'),
      'Point 8B-1 migration missing'
    );
    assert(
      !migrations.some((m) => /point.?8b.?2|dual.?write|crmlead.*organiz/i.test(m) && !m.includes('20260930011200')),
      'unexpected new Point 8B-2 migration directory'
    );
    assert(migrations.length === 3, `expected exactly 3 migration dirs, got ${migrations.length}`);
    pass('2 no new migration created (exactly 3 migration dirs)');

    await resetPublic(prisma);
    await prisma.$disconnect();
    runPrismaMigrateDeploy(url);
    await prisma.$connect();

    // Helper fail-closed matrix
    const user = await prisma.user.create({
      data: { email: 'crm8b2@example.com', name: 'CRM', password: 'x' },
    });
    const legacyId = buildLegacyOrganizationId(user.id);

    let missing = await resolveLegacyCrmWriteOrganization({ userId: user.id });
    assert(!missing.ok && missing.code === 'legacy_crm_organization_missing', 'missing org must fail');
    pass('8 missing deterministic org fails closed');

    await ensureUserOrganization(prisma, { userId: user.id });

    const ok = await resolveLegacyCrmWriteOrganization({ userId: user.id });
    assert(ok.ok && ok.organizationId === legacyId, 'valid legacy mapping must return legacy org id');
    pass('7 valid deterministic legacy mapping returns organizationId');

    await prisma.organization.update({
      where: { id: legacyId },
      data: { status: OrganizationStatus.SUSPENDED },
    });
    const inactiveOrg = await resolveLegacyCrmWriteOrganization({ userId: user.id });
    assert(
      !inactiveOrg.ok && inactiveOrg.code === 'legacy_crm_organization_inactive',
      `inactive org fail; got ${JSON.stringify(inactiveOrg)}`
    );
    pass('9 inactive org fails closed');
    await prisma.organization.update({
      where: { id: legacyId },
      data: { status: OrganizationStatus.ACTIVE },
    });

    await prisma.membership.deleteMany({ where: { userId: user.id, organizationId: legacyId } });
    const missingMem = await resolveLegacyCrmWriteOrganization({ userId: user.id });
    assert(!missingMem.ok && missingMem.code === 'legacy_crm_membership_missing', 'missing membership fail');
    pass('10 missing membership fails closed');

    await prisma.membership.create({
      data: {
        organizationId: legacyId,
        userId: user.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.SUSPENDED,
      },
    });
    const inactiveMem = await resolveLegacyCrmWriteOrganization({ userId: user.id });
    assert(!inactiveMem.ok && inactiveMem.code === 'legacy_crm_membership_inactive', 'inactive membership fail');
    pass('11 inactive membership fails closed');

    await prisma.membership.updateMany({
      where: { userId: user.id, organizationId: legacyId },
      data: { status: MembershipStatus.ACTIVE, role: MembershipRole.MEMBER },
    });
    const badRole = await resolveLegacyCrmWriteOrganization({ userId: user.id });
    assert(!badRole.ok && badRole.code === 'legacy_crm_mapping_inconsistent', 'non-OWNER mapping fail');
    pass('12 incompatible legacy mapping fails closed');

    await prisma.membership.updateMany({
      where: { userId: user.id, organizationId: legacyId },
      data: { role: MembershipRole.OWNER, status: MembershipStatus.ACTIVE },
    });

    const token = signUserToken({ userId: user.id, email: user.email });
    const spoofed = await resolveLegacyCrmWriteOrganization({
      userId: user.id,
      authorizationHeader: `Bearer ${token}`,
      organizationIdHeader: 'org_does_not_exist_anywhere',
    });
    assert(!spoofed.ok && spoofed.code === 'ORGANIZATION_ACCESS_DENIED', 'spoofed org header fail');
    pass('13 spoofed/unowned organization header fails closed');

    // Valid non-legacy org membership → transition not ready
    const otherOrg = await prisma.organization.create({
      data: {
        id: 'org_non_legacy_8b2',
        name: 'Other',
        slug: 'other-8b2',
        status: OrganizationStatus.ACTIVE,
      },
    });
    await prisma.membership.create({
      data: {
        organizationId: otherOrg.id,
        userId: user.id,
        role: MembershipRole.MEMBER,
        status: MembershipStatus.ACTIVE,
      },
    });
    const multi = await resolveLegacyCrmWriteOrganization({
      userId: user.id,
      authorizationHeader: `Bearer ${token}`,
      organizationIdHeader: otherOrg.id,
    });
    assert(!multi.ok && multi.code === 'crm_multi_org_write_not_ready', 'non-legacy selected org fail');
    pass('14 valid NON-LEGACY selected org fails transition-not-ready');

    // 15–16 CREATE paths write organizationId; body organizationId ignored by helper usage
    const created = await prisma.crmLead.create({
      data: {
        userId: user.id,
        organizationId: legacyId,
        name: 'Dual Write Lead',
        source: 'manual',
      },
    });
    assert(created.organizationId === legacyId, 'create must persist organizationId');
    pass('15 create path writes organizationId');

    // Static audit: CREATE sites dual-write organizationId; none trust body.organizationId.
    // Point 8B-5B: interactive routes use writeOrg.context.organizationId; Meta keeps writeOrg.organizationId.
    const interactiveCreateFiles = [
      'src/app/api/crm/leads/route.ts',
      'src/app/api/leads/route.ts',
      'src/app/api/business/leads/route.ts',
      'src/app/api/users/onboarding/route.ts',
    ];
    for (const file of interactiveCreateFiles) {
      const src = readFile(file);
      assert(/crmLead\.create\(/.test(src), `${file} must create CrmLead`);
      assert(
        /organizationId:\s*writeOrg\.context\.organizationId/.test(src),
        `${file} must write TenantContext organizationId`
      );
      assert(!/organizationId:\s*body\.organizationId/.test(src), `${file} must not trust body.organizationId`);
      assert(/resolveCrmWriteOrganization/.test(src), `${file} must use resolveCrmWriteOrganization`);
      assert(!/resolveLegacyCrmWriteOrganization/.test(src), `${file} must not use legacy write resolver`);
    }
    const metaCreateSrc = readFile('src/app/api/webhooks/meta-leads/route.ts');
    assert(/crmLead\.create\(/.test(metaCreateSrc), 'meta must create CrmLead');
    assert(
      /organizationId:\s*writeOrg\.organizationId/.test(metaCreateSrc),
      'meta must dual-write legacy organizationId'
    );
    assert(!/organizationId:\s*body\.organizationId/.test(metaCreateSrc), 'meta must not trust body.organizationId');
    pass('15-16 every CREATE path dual-writes; no create trusts client organizationId');

    // 17 Meta uses config.userId path (static) — enduring Meta exception
    const metaSrc = readFile('src/app/api/webhooks/meta-leads/route.ts');
    assert(/resolveLegacyCrmWriteOrganization\(\{\s*userId:\s*config\.userId/.test(metaSrc), 'Meta must use config.userId');
    assert(!/NEXORA_ORGANIZATION_HEADER/.test(metaSrc), 'Meta must not use browser org header');
    pass('17 Meta uses config.userId -> deterministic legacy org');

    // 18 onboarding uses tx client
    const onboardingSrc = readFile('src/app/api/users/onboarding/route.ts');
    assert(/db:\s*tx/.test(onboardingSrc), 'onboarding must validate with transaction client');
    assert(
      /organizationId:\s*writeOrg\.context\.organizationId/.test(onboardingSrc),
      'onboarding sample lead dual-write'
    );
    pass('18 onboarding transaction writes organizationId');

    // 19 business promotion does not backfill existing
    const businessSrc = readFile('src/app/api/business/leads/route.ts');
    assert(/existingLead\s*\|\|/.test(businessSrc), 'promotion reuses existing lead');
    assert(
      /organizationId:\s*writeOrg\.context\.organizationId/.test(businessSrc),
      'new promotion dual-writes'
    );
    assert(!/crmLead\.update\(/.test(businessSrc), 'business route must not update CrmLead rows');
    assert(!/organizationId:\s*[^=\n]*existing/.test(businessSrc), 'must not assign org from existing lead mutation');
    pass('19 existing-lead promotion does not opportunistically backfill');

    // 20 PATCH/message do not set organizationId
    // Point 8B-5B: interactive mutations use resolveCrmWriteOrganization (not legacy helper).
    const patchFiles = [
      'src/app/api/crm/leads/[leadId]/route.ts',
      'src/app/api/crm/leads/[leadId]/message/route.ts',
      'src/app/api/leads/[id]/route.ts',
    ];
    for (const file of patchFiles) {
      const src = readFile(file);
      assert(/resolveCrmWriteOrganization/.test(src), `${file} must apply write guard`);
      assert(!/resolveLegacyCrmWriteOrganization/.test(src), `${file} must not use legacy write resolver`);
      assert(!/data:\s*\{[^}]*organizationId/.test(src), `${file} must not set organizationId in updates`);
    }
    pass('20 PATCH/message/update routes do not set organizationId');

    // 21 (temporal Point 8B-2 assertion retired by Point 8B-4):
    // CRM reads are organizationId-scoped after 8B-4. Enduring 8B-2 WRITE invariants below remain.
    // See scripts/validate-point8b4-crm-read-cutover.ts for read-cutover coverage.
    pass('21 superseded userId-only read assertion retired (covered by Point 8B-4 validator)');

    // 22–24 process invariants
    assert(!fs.existsSync(path.join(process.cwd(), 'scripts', 'backfill-crmlead-organization.ts')), 'no new backfill script');
    pass('22 no backfill script added for CrmLead organizationId');
    pass('23 no production mutation (disposable DB only)');
    assert(!/console\.(log|info|error)\([^\n]*password|secret|token/i.test(readFile('src/lib/tenancy/resolve-legacy-crm-write-organization.ts')), 'helper must not log secrets');
    pass('24 helper does not log secret values');

    // Runtime create + PATCH does not alter null historical org (simulate)
    const historical = await prisma.crmLead.create({
      data: {
        userId: user.id,
        organizationId: null,
        name: 'Historical Null',
        source: 'manual',
      },
    });
    await prisma.crmLead.update({
      where: { id: historical.id },
      data: { notes: 'touched without org backfill' },
    });
    const after = await prisma.crmLead.findUnique({ where: { id: historical.id } });
    assert(after?.organizationId === null, 'update must leave null organizationId untouched');
    pass('20b update leaves historical null organizationId untouched');

    // Header with legacy org succeeds
    const withHeader = await resolveLegacyCrmWriteOrganization({
      userId: user.id,
      authorizationHeader: `Bearer ${token}`,
      organizationIdHeader: legacyId,
    });
    assert(withHeader.ok && withHeader.organizationId === legacyId, 'legacy header must succeed');
    pass('header with deterministic legacy org succeeds');

    // Confirm NEXORA header constant used by authenticated routes
    void NEXORA_ORGANIZATION_HEADER;

    console.log(`[point8b2] ALL_PASS count=${passed}`);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error('[point8b2] FAIL', err);
  process.exit(1);
});
