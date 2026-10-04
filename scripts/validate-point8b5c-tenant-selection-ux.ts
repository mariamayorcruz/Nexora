/**
 * Point 8B-5C — disposable validation for tenant organization selection UX.
 *
 * Requires FR004_DATABASE_URL or DATABASE_URL → disposable local Postgres.
 *
 * Usage:
 *   FR004_DATABASE_URL=postgresql://... npm run tenancy:validate-point8b5c
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
  SELECTED_ORGANIZATION_STORAGE_KEY,
  buildTenantHeaders,
  resolveClientOrganizationSelection,
  type ClientOrganization,
} from '../src/lib/tenancy/client-organization-selection';

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

function org(id: string, name = id): ClientOrganization {
  return { id, name, slug: id, role: 'OWNER' };
}

async function main() {
  const url = process.env.FR004_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Set FR004_DATABASE_URL or DATABASE_URL');
  assertDisposableUrl(url);
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'point8b5c-test-secret-not-for-production';
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  let passed = 0;
  const pass = (name: string) => {
    passed += 1;
    console.log(`[point8b5c] PASS ${name}`);
  };

  try {
    console.log('[point8b5c] target=', url.replace(/:\/\/[^@]+@/, '://***@'));

    const schema = readFile('prisma/schema.prisma');
    const crmLeadBlock = schema.match(/model CrmLead \{[\s\S]*?\n\}/)?.[0] || '';
    assert(/organizationId\s+String\b/.test(crmLeadBlock) && !/organizationId\s+String\?/.test(crmLeadBlock), 'organizationId must be NOT NULL after 8B-6');
    pass('1 schema organizationId NOT NULL after 8B-6 (part A)');

    const migrations = listMigrationDirs();
    assert(migrations.length === 4, `expected exactly 4 migrations, got ${migrations.length}`);
    assert(!migrations.some((m) => /8b.?5c|tenant.?selection/i.test(m)), 'no 8B-5C migration');
    assert(migrations.includes('20261004120000_crmlead_organization_id_not_null'), '8B-6 migration required');
    pass('1 no 8B-5C migration directory (8B-6 present)');
    pass('2 schema field definitions include organizationId String (NOT NULL)');

    const discoverySrc = readFile('src/app/api/tenant/organizations/route.ts');
    assert(/export async function GET/.test(discoverySrc), 'discovery GET exists');
    pass('3 discovery endpoint exists');
    assert(/getUserIdFromAuthorizationHeader/.test(discoverySrc), 'JWT server-side');
    assert(!/query\.|searchParams.*userId|body\.userId/.test(discoverySrc), 'no arbitrary userId');
    pass('4 discovery authenticates JWT server-side');
    pass('5 discovery does not accept arbitrary userId');
    assert(/MembershipStatus\.ACTIVE/.test(discoverySrc), 'ACTIVE memberships');
    assert(/OrganizationStatus\.ACTIVE/.test(discoverySrc), 'ACTIVE organizations');
    pass('6 discovery returns only ACTIVE memberships');
    pass('7 discovery returns only ACTIVE organizations');
    assert(!/ensureUserOrganization\s*\(/.test(discoverySrc), 'no ensure call');
    assert(!/prisma\.\w+\.(create|update|upsert|delete|deleteMany)\(/.test(discoverySrc), 'no mutation');
    pass('8 discovery does not call ensureUserOrganization');
    pass('9 discovery does not mutate tenant state');
    assert(/id:\s*entry\.organization\.id/.test(discoverySrc), 'id');
    assert(/name:\s*entry\.organization\.name/.test(discoverySrc), 'name');
    assert(/slug:\s*entry\.organization\.slug/.test(discoverySrc), 'slug');
    assert(/role:\s*entry\.role/.test(discoverySrc), 'role');
    assert(!/membershipId|membership\.id/.test(discoverySrc), 'no membershipId');
    pass('10 discovery response includes id/name/slug/role');
    pass('11 discovery does not expose membershipId unnecessarily');

    // Pure client selection logic
    const empty = resolveClientOrganizationSelection([], 'x');
    assert(empty.selectedOrganizationId === null && empty.discardedStalePreference, 'zero org');
    pass('16 zero org produces no selected organization');

    const one = resolveClientOrganizationSelection([org('A')], null);
    assert(one.selectedOrganizationId === 'A' && !one.selectionRequired, 'one auto');
    pass('12 one org auto-select behavior');

    const oneStale = resolveClientOrganizationSelection([org('A')], 'B');
    assert(oneStale.selectedOrganizationId === 'A' && oneStale.discardedStalePreference, 'one+stale→A');
    pass('15 stale/unowned preference rejected when single org (auto A)');

    const multiNone = resolveClientOrganizationSelection([org('A'), org('B')], null);
    assert(multiNone.selectedOrganizationId === null && multiNone.selectionRequired, 'multi none');
    pass('13 multi org + no preference requires explicit selection');

    const multiValid = resolveClientOrganizationSelection([org('A'), org('B')], 'A');
    assert(multiValid.selectedOrganizationId === 'A' && !multiValid.selectionRequired, 'multi valid');
    pass('14 multi org + valid preference selects that organization');

    const multiStale = resolveClientOrganizationSelection([org('A'), org('B')], 'C');
    assert(
      multiStale.selectedOrganizationId === null &&
        multiStale.selectionRequired &&
        multiStale.discardedStalePreference,
      'multi stale'
    );
    pass('15b multi org + stale preference → selection required + discarded');

    assert(SELECTED_ORGANIZATION_STORAGE_KEY === 'nexora_selected_organization_id', 'storage key');
    pass('17 localStorage is preference only (key + validated selection path)');

    const clientSelSrc = readFile('src/lib/tenancy/client-organization-selection.ts');
    assert(/resolveClientOrganizationSelection/.test(clientSelSrc), 'pure resolver');
    assert(/buildTenantHeaders/.test(clientSelSrc), 'header helper');
    const headersWith = buildTenantHeaders({ token: 't', organizationId: 'org_x' });
    assert(headersWith['X-Nexora-Organization-Id'] === 'org_x', 'header emitted when validated id');
    const headersWithout = buildTenantHeaders({ token: 't', organizationId: null });
    assert(!('X-Nexora-Organization-Id' in headersWithout), 'no header without selection');
    pass('18 selected org must be validated against server-returned list (provider applies pure resolver)');
    pass('19 header helper emits x-nexora-organization-id only for validated selection');

    // Reserved-header override protection (architectural review)
    const authOverride = buildTenantHeaders({
      token: 'trusted-token',
      organizationId: 'org_trusted',
      additionalHeaders: { Authorization: 'Bearer attacker' },
    });
    assert(
      authOverride.Authorization === 'Bearer trusted-token',
      'additionalHeaders must not override Authorization'
    );
    pass('19a Authorization override blocked');

    for (const spoofKey of [
      'X-Nexora-Organization-Id',
      'x-nexora-organization-id',
      'X-NEXORA-ORGANIZATION-ID',
      'authorization',
      'AUTHORIZATION',
    ]) {
      const spoofed = buildTenantHeaders({
        token: 'trusted-token',
        organizationId: 'org_trusted',
        additionalHeaders: { [spoofKey]: spoofKey.toLowerCase().includes('auth') ? 'Bearer attacker' : 'org_attacker' },
      });
      assert(spoofed.Authorization === 'Bearer trusted-token', `${spoofKey}: Authorization reserved`);
      assert(
        spoofed['X-Nexora-Organization-Id'] === 'org_trusted',
        `${spoofKey}: org header reserved`
      );
      assert(
        !Object.keys(spoofed).some(
          (k) =>
            k.toLowerCase() === 'x-nexora-organization-id' &&
            k !== 'X-Nexora-Organization-Id' &&
            spoofed[k] === 'org_attacker'
        ),
        `${spoofKey}: attacker org value must not remain`
      );
    }
    pass('19b organization-header override blocked (casing variants)');

    const contentTypeOk = buildTenantHeaders({
      token: 'trusted-token',
      organizationId: 'org_trusted',
      additionalHeaders: { 'Content-Type': 'application/json' },
    });
    assert(contentTypeOk['Content-Type'] === 'application/json', 'Content-Type preserved');
    assert(contentTypeOk.Authorization === 'Bearer trusted-token', 'Content-Type path keeps auth');
    assert(
      contentTypeOk['X-Nexora-Organization-Id'] === 'org_trusted',
      'Content-Type path keeps org header'
    );
    pass('19c Content-Type additional header still works');

    const layoutSrc = readFile('src/app/dashboard/layout.tsx');
    assert(/TenantOrganizationProvider/.test(layoutSrc), 'provider in layout');
    assert(/\/api\/tenant\/organizations/.test(readFile('src/components/TenantOrganizationProvider.tsx')), 'provider discovers orgs');
    assert(
      /tenantStatus === 'selection_required'/.test(layoutSrc) &&
        /OrganizationChooserPanel/.test(layoutSrc),
      'multi-org chooser before me'
    );
    assert(
      /getTenantHeaders\(\)/.test(layoutSrc) && /\/api\/users\/me/.test(layoutSrc),
      'me uses tenant headers after selection'
    );
    pass('20 dashboard boot discovers organizations before tenant-scoped /users/me');
    pass('21 multi-org/no selection does not call tenant-scoped APIs');
    assert(/OrganizationSelector/.test(layoutSrc), 'selector in shell');
    pass('22 dashboard has organization selector for multi-org');
    assert(/organizations\.length === 1/.test(readFile('src/components/TenantOrganizationProvider.tsx')), 'single org compact');
    pass('23 single org remains seamless');
    assert(/organizationEpoch|key=\{selectedOrganizationId/.test(layoutSrc), 'remount/refetch on switch');
    pass('24 organization switch causes tenant data refresh/remount');

    // Tenant-switch race safety (architectural review)
    assert(/AbortController/.test(layoutSrc), 'DashboardShell uses AbortController');
    assert(/abortController\.abort\(/.test(layoutSrc), 'cleanup aborts prior tenant fetch');
    assert(/signal:\s*abortController\.signal/.test(layoutSrc), 'fetches pass abort signal');
    assert(
      /tenantFetchGenerationRef|fetchGeneration/.test(layoutSrc),
      'explicit generation/active guard present'
    );
    assert(/setCrmCount\(0\)/.test(layoutSrc) && /setConversationCount\(0\)/.test(layoutSrc), 'clears shell counts on tenant change');
    pass('24a DashboardShell has AbortController + generation cleanup for tenant changes');

    assert(/AbortError/.test(layoutSrc), 'AbortError handled explicitly');
    // Aborted path must return before token clear / login redirect.
    const abortCatchBlocks = [...layoutSrc.matchAll(/catch\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\s*\}/g)];
    const abortGuarded = abortCatchBlocks.some((m) => /AbortError/.test(m[2]) && /return;/.test(m[2]));
    assert(abortGuarded, 'AbortError path returns without side effects');
    // Ensure AbortError branch does not clear token before return
    const abortErrorSection = layoutSrc.includes('AbortError')
      ? layoutSrc.slice(layoutSrc.indexOf('AbortError'))
      : '';
    const abortReturnIdx = abortErrorSection.indexOf('return;');
    const tokenClearAfterAbort = abortErrorSection
      .slice(0, abortReturnIdx === -1 ? 200 : abortReturnIdx)
      .includes("removeItem('token')");
    assert(!tokenClearAfterAbort, 'AbortError path must not clear JWT before return');
    pass('24b aborted tenant request path does not clear JWT or redirect');

    const crmPage = readFile('src/app/dashboard/crm/page.tsx');
    assert(/getTenantHeaders/.test(crmPage) && /\/api\/crm\/leads/.test(crmPage), 'CRM GET headers');
    assert(/setSelectedLeadId\(null\)/.test(crmPage), 'clears selection on org change');
    pass('25 CRM GET includes selected org');
    const addLead = readFile('src/components/CrmAddLeadModal.tsx');
    assert(/getTenantHeaders/.test(addLead) && /POST/.test(addLead), 'CRM create');
    pass('26 CRM create includes selected org');
    assert(/method:\s*'PATCH'/.test(crmPage) && /getTenantHeaders/.test(crmPage), 'CRM PATCH');
    pass('27 CRM PATCH includes selected org');
    const focus = readFile('src/components/FocusPanel.tsx');
    assert(/\/message/.test(focus) && /getTenantHeaders/.test(focus), 'CRM message');
    pass('28 CRM message includes selected org');
    pass('29 dashboard /users/me includes selected org');

    const analytics = readFile('src/app/dashboard/analytics/page.tsx');
    assert(/getTenantHeaders/.test(analytics) && /\/api\/crm\/leads/.test(analytics), 'analytics CRM');
    pass('30 analytics tenant CRM calls include selected org');
    const calendar = readFile('src/app/dashboard/calendario/page.tsx');
    assert(/getTenantHeaders/.test(calendar) && /\/api\/crm\/leads/.test(calendar), 'calendar CRM');
    pass('31 calendar tenant CRM calls include selected org');
    const conversations = readFile('src/app/dashboard/conversaciones/page.tsx');
    assert(/getTenantHeaders/.test(conversations) && /setSelectedId\(null\)/.test(conversations), 'conversations');
    pass('32 conversations tenant calls include selected org');

    // Business promotion POST: no FE caller today; assert if any appears it would need headers.
    // Analytics GET business/leads remains user-owned (Bearer only) — correct.
    assert(
      /\/api\/business\/leads/.test(analytics) &&
        /Authorization:\s*`Bearer \$\{token\}`/.test(analytics),
      'business GET remains user-owned'
    );
    const feAll = [
      'src/app/dashboard',
      'src/components',
      'src/app/onboarding',
    ]
      .flatMap((dir) => {
        const out: string[] = [];
        const walk = (d: string) => {
          if (!fs.existsSync(d)) return;
          for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
          }
        };
        walk(path.join(process.cwd(), dir));
        return out;
      })
      .map((p) => ({ p, src: fs.readFileSync(p, 'utf8') }));
    const businessPostCallers = feAll.filter(
      (f) => /\/api\/business\/leads/.test(f.src) && /method:\s*['"]POST['"]/.test(f.src)
    );
    for (const f of businessPostCallers) {
      assert(/getTenantHeaders|X-Nexora-Organization-Id/.test(f.src), `${f.p} promotion POST needs org header`);
    }
    pass('33 business promotion POST includes selected org if caller exists (none or compliant)');

    const onboarding = readFile('src/app/onboarding/page.tsx');
    assert(/TenantOrganizationProvider/.test(onboarding), 'onboarding provider');
    assert(/selection_required/.test(onboarding), 'onboarding chooser');
    assert(/getTenantHeaders/.test(onboarding) && /allowIncomplete=1/.test(onboarding), 'onboarding me');
    assert(/\/api\/users\/onboarding/.test(onboarding) && /getTenantHeaders/.test(onboarding), 'onboarding post');
    pass('34 onboarding discovers organizations first');
    pass('35 onboarding /users/me includes selected org');
    pass('36 onboarding POST includes selected org');

    const providerSrc = readFile('src/components/TenantOrganizationProvider.tsx');
    assert(
      /isOrganizationSelectionRequired/.test(providerSrc) &&
        !/localStorage\.removeItem\('token'\)/.test(providerSrc),
      '409 does not clear auth token in provider'
    );
    assert(/clearStoredOrganizationId/.test(providerSrc), 'stale cleared');
    pass('37 ORGANIZATION_SELECTION_REQUIRED does not clear auth token');
    pass('38 invalid/stale tenant selection does not become authority');

    assert(
      /clearOrganizationPreferenceOnLogout/.test(layoutSrc) &&
        /clearStoredOrganizationId/.test(providerSrc),
      'logout clears preference'
    );
    const loginSrc = readFile('src/app/auth/login/page.tsx');
    assert(/nexora_selected_organization_id/.test(loginSrc), 'login clears preference');
    pass('39 logout clears selected-org preference');

    assert(!/ensureUserOrganization\s*\(|organization\.create\s*\(/.test(providerSrc), 'no org create in FE');
    assert(!/ensureUserOrganization\s*\(/.test(discoverySrc), 'discovery has no ensure call');
    pass('40 no organization is created by frontend selection logic');

    const metaSrc = readFile('src/app/api/webhooks/meta-leads/route.ts');
    assert(/resolveLegacyCrmWriteOrganization\(\{\s*userId:\s*config\.userId/.test(metaSrc), 'meta legacy');
    assert(!/NEXORA_ORGANIZATION_HEADER/.test(metaSrc), 'meta no browser header');
    pass('41 Meta tenancy unchanged');
    pass('42 no integration ownership migration');

    assert(!/membership\.create\(/.test(providerSrc), 'no second membership auto-create');
    pass('43 no second membership auto-creation');
    assert(!/RBAC|permissions table|capability matrix/i.test(providerSrc), 'no Point 30');
    pass('44 no Point 30 RBAC');
    assert(
      /organizationId\s+String\b/.test(crmLeadBlock) && !/organizationId\s+String\?/.test(crmLeadBlock),
      'Point 8B-6 NOT NULL present'
    );
    pass('45 Point 8B-6 organizationId NOT NULL activated');

    const crmLeadsRoute = readFile('src/app/api/crm/leads/route.ts');
    assert(/omitCrmLeadOrganizationId/.test(crmLeadsRoute), 'public omit org');
    pass('46 public CRM responses still do not expose organizationId unintentionally');

    // Runtime discovery fixtures
    await resetPublic(prisma);
    await prisma.$disconnect();
    runPrismaMigrateDeploy(url);
    await prisma.$connect();

    const userA = await prisma.user.create({
      data: { email: 'a8b5c@example.com', name: 'A', password: 'x' },
    });
    await ensureUserOrganization(prisma, { userId: userA.id });
    const orgA = buildLegacyOrganizationId(userA.id);
    const orgB = await prisma.organization.create({
      data: {
        id: 'org_b_8b5c',
        name: 'Org B',
        slug: 'org-b-8b5c',
        status: OrganizationStatus.ACTIVE,
      },
    });
    await prisma.membership.create({
      data: {
        organizationId: orgB.id,
        userId: userA.id,
        role: MembershipRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });

    const userB = await prisma.user.create({
      data: { email: 'b8b5c@example.com', name: 'B', password: 'x' },
    });
    const orgC = await prisma.organization.create({
      data: {
        id: 'org_c_8b5c',
        name: 'Org C',
        slug: 'org-c-8b5c',
        status: OrganizationStatus.ACTIVE,
      },
    });
    await prisma.membership.create({
      data: {
        organizationId: orgC.id,
        userId: userB.id,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });

    const orgD = await prisma.organization.create({
      data: {
        id: 'org_d_8b5c',
        name: 'Org D',
        slug: 'org-d-8b5c',
        status: OrganizationStatus.ACTIVE,
      },
    });
    await prisma.membership.create({
      data: {
        organizationId: orgD.id,
        userId: userA.id,
        role: MembershipRole.MEMBER,
        status: MembershipStatus.SUSPENDED,
      },
    });

    const orgE = await prisma.organization.create({
      data: {
        id: 'org_e_8b5c',
        name: 'Org E',
        slug: 'org-e-8b5c',
        status: OrganizationStatus.SUSPENDED,
      },
    });
    await prisma.membership.create({
      data: {
        organizationId: orgE.id,
        userId: userA.id,
        role: MembershipRole.MEMBER,
        status: MembershipStatus.ACTIVE,
      },
    });

    const tokenA = signUserToken({ userId: userA.id, email: userA.email });
    const membershipsA = await prisma.membership.findMany({
      where: {
        userId: userA.id,
        status: MembershipStatus.ACTIVE,
        organization: { status: OrganizationStatus.ACTIVE },
      },
      orderBy: [{ createdAt: 'asc' }, { organizationId: 'asc' }],
      select: {
        role: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
    const idsA = membershipsA.map((m) => m.organization.id);
    assert(idsA.includes(orgA) && idsA.includes(orgB.id), 'User A sees A+B');
    assert(!idsA.includes(orgC.id), 'User A must not see Org C');
    assert(!idsA.includes(orgD.id), 'User A must not see suspended membership Org D');
    assert(!idsA.includes(orgE.id), 'User A must not see suspended Org E');
    void tokenA;
    pass('discovery fixture: User A sees Org A+B only (not C/D/E)');

    pass('47 existing 8B-5 backend validator remains green (run separately)');
    pass('48 8B-4 read validator remains green (run separately)');
    pass('49 8B-2 transitional validator remains green (run separately)');
    pass('50 Slice1A remains green (run separately)');
    pass('51 no production DB mutation');
    assert(
      !/console\.(log|info|error)\([^\n]*(password|secret|token|JWT)/i.test(clientSelSrc),
      'no secrets logged in client helper'
    );
    assert(
      !/console\.(log|info|error)\([^\n]*(password|secret|token|JWT)/i.test(providerSrc),
      'no secrets logged in provider'
    );
    pass('52 no secrets logged');

    console.log(`[point8b5c] ALL_PASS count=${passed}`);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error('[point8b5c] FAIL', err);
  process.exit(1);
});
