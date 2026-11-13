/**
 * Point 8 step 4A-1B — disposable Postgres validation for inactive CRM
 * read-policy candidate persistence (+ corrective hardening migration).
 *
 * Contract reference (fixed): PR #23 HEAD
 *   02c8a573b967d7656c8f5e057003b49ae214d0c5
 * Pure validators live on that PR and are NOT imported or duplicated here.
 * This script exercises real database constraints only.
 *
 * VALIDATED fixtures (for negative tests only) are created by temporarily
 * DISABLE TRIGGER as the disposable superuser — never via a product GUC/bypass.
 *
 * Requires FR004_DATABASE_URL or DATABASE_URL → disposable local Postgres.
 * Refuses hosted/production-looking URLs. No production secrets.
 *
 * Usage:
 *   FR004_DATABASE_URL=postgresql://... npm run tenancy:validate-point8-4a1b
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BASELINE_NAME,
  POINT8B1_NAME,
  POINT8B6_NAME,
  POINT8_4A1B_HARDENING_NAME,
  POINT8_4A1B_NAME,
  SLICE0_NAME,
  assertActiveMigrationSet,
  assertDisposableDatabaseUrl,
  prismaCliVersion,
  psql,
  readMigrationRows,
  repoRoot,
  runPrisma,
  sanitizeDbUrlForLog,
} from './fr004-lib';

type Scenario = { name: string; run: () => void };

const POLICY_TABLES = [
  'CrmReadPolicyBundle',
  'CrmReadPolicyBundleMembershipLink',
  'CrmReadPolicyBundleLeadLink',
  'CrmReadPolicyRetiredGrantLogicalId',
  'CrmReadPolicyGrant',
  'CrmReadPolicyGrantFieldClass',
  'CrmReadPolicyRestriction',
  'CrmReadPolicyRestrictionFieldClass',
  'CrmReadPolicyChangeEvidence',
  'CrmReadPolicyChangeEvidenceFieldClass',
] as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function resetPublic(url: string) {
  psql(url, 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
}

function expectFail(url: string, sql: string, label: string, pattern?: RegExp) {
  let failed = false;
  let out = '';
  try {
    psql(url, sql);
  } catch (err) {
    failed = true;
    const e = err as { stdout?: string; stderr?: string; message?: string };
    out = `${e.stdout || ''}${e.stderr || ''}${e.message || ''}`;
  }
  assert(failed, `${label} must fail`);
  if (pattern) {
    assert(pattern.test(out), `${label}: missing fail signal in: ${out.slice(0, 800)}`);
  }
}

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function seedTenants(url: string) {
  const t = nowIso();
  const userA = id('user');
  const userB = id('user');
  const orgA = id('org');
  const orgB = id('org');
  const memA = id('mem');
  const memB = id('mem');
  const leadA = id('lead');
  const leadB = id('lead');

  psql(
    url,
    `INSERT INTO "User" ("id","email","password","nurtureStatus","createdAt","updatedAt") VALUES
      ('${userA}','${userA}@example.com','x','not-consented','${t}','${t}'),
      ('${userB}','${userB}@example.com','x','not-consented','${t}','${t}');
     INSERT INTO "Organization" ("id","name","slug","status","createdAt","updatedAt") VALUES
      ('${orgA}','Org A','slug-${orgA}','ACTIVE','${t}','${t}'),
      ('${orgB}','Org B','slug-${orgB}','ACTIVE','${t}','${t}');
     INSERT INTO "Membership" ("id","organizationId","userId","role","status","createdAt","updatedAt") VALUES
      ('${memA}','${orgA}','${userA}','OWNER','ACTIVE','${t}','${t}'),
      ('${memB}','${orgB}','${userB}','OWNER','ACTIVE','${t}','${t}');
     INSERT INTO "CrmLead" ("id","userId","organizationId","name","source","stage","status","value","confidence","createdAt","updatedAt") VALUES
      ('${leadA}','${userA}','${orgA}','Lead A','manual','lead','nuevo',0,25,'${t}','${t}'),
      ('${leadB}','${userB}','${orgB}','Lead B','manual','lead','nuevo',0,25,'${t}','${t}');`
  );

  return { t, userA, userB, orgA, orgB, memA, memB, leadA, leadB };
}

function insertDraftBundle(
  url: string,
  opts: {
    bundleId: string;
    orgId: string;
    version: number;
    checksum?: string | null;
    predecessorVersion?: number | null;
    t: string;
  }
) {
  const checksumSql = opts.checksum == null ? 'NULL' : `'${opts.checksum}'`;
  const predOrg = opts.predecessorVersion == null ? 'NULL' : `'${opts.orgId}'`;
  const predVer = opts.predecessorVersion == null ? 'NULL' : String(opts.predecessorVersion);
  psql(
    url,
    `INSERT INTO "CrmReadPolicyBundle"
      ("id","organizationId","version","status","canonicalVersion","contentChecksum",
       "predecessorOrganizationId","predecessorVersion","createdAt","updatedAt")
     VALUES
      ('${opts.bundleId}','${opts.orgId}',${opts.version},'DRAFT',
       'crm-read-policy-canonical/v1',${checksumSql},${predOrg},${predVer},'${opts.t}','${opts.t}');`
  );
}

/**
 * Disposable-only privileged fixture: superuser session_replication_role=replica
 * suppresses user triggers for the transaction, inserts a VALIDATED snapshot,
 * then restores origin. Not a product bypass and not left in migrations.
 */
function privilegedInsertValidatedFixture(
  url: string,
  opts: {
    bundleId: string;
    orgId: string;
    version: number;
    memId: string;
    t: string;
    withGrant?: boolean;
    withRetired?: boolean;
    evidence?: { id: string; evidenceId: string; fromVersion: number; toVersion: number };
  }
) {
  const inserts: string[] = [
    `INSERT INTO "CrmReadPolicyBundle"
      ("id","organizationId","version","status","canonicalVersion","contentChecksum","createdAt","updatedAt")
     VALUES ('${opts.bundleId}','${opts.orgId}',${opts.version},'VALIDATED',
       'crm-read-policy-canonical/v1','crm-read-policy-canonical/v1:fixture','${opts.t}','${opts.t}')`,
  ];
  if (opts.withRetired) {
    inserts.push(
      `INSERT INTO "CrmReadPolicyRetiredGrantLogicalId" ("organizationId","bundleId","logicalId")
       VALUES ('${opts.orgId}','${opts.bundleId}','g_retired')`
    );
  }
  if (opts.withGrant) {
    inserts.push(
      `INSERT INTO "CrmReadPolicyGrant"
         ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind",
          "originKind","originOrganizationId","originRootValidated","createdAt","updatedAt")
       VALUES ('${opts.orgId}','${opts.bundleId}','gv_locked','g_locked','${opts.memId}','COMPANY',
          'LEGACY_SNAPSHOT','${opts.orgId}',true,'${opts.t}','${opts.t}')`
    );
  }
  if (opts.evidence) {
    inserts.push(
      `INSERT INTO "CrmReadPolicyChangeEvidence"
         ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind",
          "targetLogicalId","createdAt")
       VALUES ('${opts.evidence.id}','${opts.evidence.evidenceId}','${opts.orgId}',
         ${opts.evidence.fromVersion},${opts.evidence.toVersion},'ADD_GRANT','g_x','${opts.t}')`
    );
  }
  psql(
    url,
    `BEGIN;
     SET LOCAL session_replication_role = replica;
     ${inserts.join(';\n')};
     SET LOCAL session_replication_role = origin;
     COMMIT;`
  );
}

const CLIENT_ROLES = ['anon', 'authenticated', 'authenticator'] as const;

function ensureClientRoles(url: string) {
  for (const role of CLIENT_ROLES) {
    psql(
      url,
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
           CREATE ROLE ${role} NOLOGIN;
         END IF;
       END $$;`
    );
  }
}

function tablePrivCsv(url: string, role: string, table: string): string {
  return psql(
    url,
    `SELECT COALESCE(has_table_privilege('${role}', '"${table}"', 'SELECT'), false)::text
     || ',' || COALESCE(has_table_privilege('${role}', '"${table}"', 'INSERT'), false)::text
     || ',' || COALESCE(has_table_privilege('${role}', '"${table}"', 'UPDATE'), false)::text
     || ',' || COALESCE(has_table_privilege('${role}', '"${table}"', 'DELETE'), false)::text
     || ',' || COALESCE(has_table_privilege('${role}', '"${table}"', 'TRUNCATE'), false)::text;`
  );
}

function grantSimulatedClientPrivileges(url: string) {
  // Schema USAGE mirrors typical Supabase client access; table DML/TRUNCATE are
  // the privileges the hardening migration must remove.
  const grants = [
    `GRANT USAGE ON SCHEMA public TO ${CLIENT_ROLES.join(', ')}`,
    ...CLIENT_ROLES.flatMap((role) =>
      POLICY_TABLES.map(
        (table) =>
          `GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE "${table}" TO ${role}`
      )
    ),
  ];
  psql(url, `${grants.join(';\n')};`);
}

function assertClientPrivilegesPresent(url: string, label: string) {
  for (const role of CLIENT_ROLES) {
    for (const table of POLICY_TABLES) {
      const priv = tablePrivCsv(url, role, table);
      assert(
        priv === 'true,true,true,true,true',
        `${label}: expected simulated client privs on ${table} for ${role}, got ${priv}`
      );
    }
  }
}

function assertClientPrivilegesAbsent(url: string, label: string) {
  for (const role of CLIENT_ROLES) {
    for (const table of POLICY_TABLES) {
      const priv = tablePrivCsv(url, role, table);
      assert(
        priv === 'false,false,false,false,false',
        `${label}: ${role} must lack DML/TRUNCATE on ${table} after hardening, got ${priv}`
      );
    }
  }
}

/** Deploy a contiguous prefix of active migrations from a temporary folder. */
function deployMigrationPrefix(env: NodeJS.ProcessEnv, migrationNames: string[]): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexora-point8-4a1b-prefix-'));
  try {
    const prismaDir = path.join(tmp, 'prisma');
    const migrationsDir = path.join(prismaDir, 'migrations');
    fs.mkdirSync(migrationsDir, { recursive: true });
    fs.copyFileSync(
      path.join(repoRoot(), 'prisma', 'schema.prisma'),
      path.join(prismaDir, 'schema.prisma')
    );
    fs.copyFileSync(
      path.join(repoRoot(), 'prisma', 'migrations', 'migration_lock.toml'),
      path.join(migrationsDir, 'migration_lock.toml')
    );
    for (const name of migrationNames) {
      fs.cpSync(
        path.join(repoRoot(), 'prisma', 'migrations', name),
        path.join(migrationsDir, name),
        { recursive: true }
      );
    }
    return runPrisma(['migrate', 'deploy', '--schema', path.join(prismaDir, 'schema.prisma')], env);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function main(): void {
  const url = process.env.FR004_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Set FR004_DATABASE_URL or DATABASE_URL to a disposable Postgres');
  assertDisposableDatabaseUrl(url);
  assertActiveMigrationSet();

  console.log(`[point8-4a1b] prisma=${prismaCliVersion()}`);
  console.log(`[point8-4a1b] target=${sanitizeDbUrlForLog(url)}`);
  console.log(
    '[point8-4a1b] contract_ref=PR#23@02c8a573b967d7656c8f5e057003b49ae214d0c5 (validators not imported)'
  );
  console.log(
    '[point8-4a1b] prior_migration_applied_on=disposable local Postgres nexora_point8_4a1b@127.0.0.1 (not production)'
  );

  const env = { ...process.env, DATABASE_URL: url };
  console.log('[point8-4a1b] prisma validate');
  runPrisma(['validate'], env);
  console.log('[point8-4a1b] prisma generate');
  runPrisma(['generate'], env);

  resetPublic(url);
  console.log('[point8-4a1b] migrate deploy from empty schema');
  const deployOut = runPrisma(['migrate', 'deploy'], env);
  assert(deployOut.includes(POINT8_4A1B_NAME), '4A-1B migration must apply');
  assert(deployOut.includes(POINT8_4A1B_HARDENING_NAME), '4A-1B hardening migration must apply');
  const names = readMigrationRows(url).map((r) => r.migration_name);
  assert(
    names.length === 6 &&
      names[0] === BASELINE_NAME &&
      names[1] === SLICE0_NAME &&
      names[2] === POINT8B1_NAME &&
      names[3] === POINT8B6_NAME &&
      names[4] === POINT8_4A1B_NAME &&
      names[5] === POINT8_4A1B_HARDENING_NAME,
    `unexpected migration rows: ${names.join(',')}`
  );

  const gucGone = psql(
    url,
    `SELECT COUNT(*)::text FROM pg_proc WHERE proname = 'crm_read_policy_allow_validated_snapshot_write';`
  );
  assert(gucGone === '0', 'product GUC bypass function must be dropped');

  const scenarios: Scenario[] = [
    {
      name: 'controles positivos: almacenamiento DRAFT válido',
      run: () => {
        const s = seedTenants(url);
        const b1 = id('bundle');
        const b2 = id('bundle');
        insertDraftBundle(url, { bundleId: b1, orgId: s.orgA, version: 1, t: s.t });
        insertDraftBundle(url, {
          bundleId: b2,
          orgId: s.orgA,
          version: 2,
          predecessorVersion: 1,
          t: s.t,
        });
        psql(
          url,
          `INSERT INTO "CrmReadPolicyRetiredGrantLogicalId" ("organizationId","bundleId","logicalId")
           VALUES ('${s.orgA}','${b1}','g_retired');
           INSERT INTO "CrmReadPolicyBundleMembershipLink" ("organizationId","bundleId","membershipId")
           VALUES ('${s.orgA}','${b1}','${s.memA}');
           INSERT INTO "CrmReadPolicyBundleLeadLink" ("organizationId","bundleId","leadId")
           VALUES ('${s.orgA}','${b1}','${s.leadA}');
           INSERT INTO "CrmReadPolicyGrant"
             ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind","scopeLeadId",
              "validity","parentVersionId","originKind","originOrganizationId","originRootValidated",
              "originRevoked","createdAt","updatedAt")
           VALUES
             ('${s.orgA}','${b1}','gv_root','g_logic','${s.memA}','COMPANY',NULL,'ACTIVE',NULL,
              'LEGACY_SNAPSHOT','${s.orgA}',true,false,'${s.t}','${s.t}'),
             ('${s.orgA}','${b1}','gv_child','g_child','${s.memA}','RECORD','${s.leadA}','ACTIVE','gv_root',
              'LEGACY_SNAPSHOT','${s.orgA}',true,false,'${s.t}','${s.t}');
           INSERT INTO "CrmReadPolicyGrantFieldClass"
             ("organizationId","bundleId","grantVersionId","fieldClass")
           VALUES ('${s.orgA}','${b1}','gv_root','IDENTIDAD'), ('${s.orgA}','${b1}','gv_root','GESTION');
           INSERT INTO "CrmReadPolicyRestriction"
             ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind","scopeLeadId",
              "validity","authorMembershipId","createdAt","updatedAt")
           VALUES ('${s.orgA}','${b1}','rv1','r_logic','${s.memA}','COMPANY',NULL,'ACTIVE','${s.memA}','${s.t}','${s.t}');
           INSERT INTO "CrmReadPolicyRestrictionFieldClass"
             ("organizationId","bundleId","restrictionVersionId","fieldClass")
           VALUES ('${s.orgA}','${b1}','rv1','RESERVADO');
           INSERT INTO "CrmReadPolicyChangeEvidence"
             ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind","targetLogicalId",
              "beforeSnapshot","afterSnapshot","createdAt")
           VALUES ('${id('evrow')}','ev1','${s.orgA}',1,2,'ADD_GRANT','g_new',
             NULL,'{"membershipId":"${s.memA}"}','${s.t}');`
        );
        const retired = psql(
          url,
          `SELECT "logicalId" FROM "CrmReadPolicyRetiredGrantLogicalId"
           WHERE "bundleId"='${b1}' ORDER BY "logicalId";`
        );
        assert(retired === 'g_retired', `retired history round-trip failed: ${retired}`);
        const empty = id('bundle');
        insertDraftBundle(url, { bundleId: empty, orgId: s.orgB, version: 1, t: s.t });
        assert(
          psql(url, `SELECT COUNT(*)::text FROM "CrmReadPolicyGrant" WHERE "bundleId"='${empty}';`) ===
            '0',
          'empty candidate policy must allow zero grants'
        );
      },
    },
    {
      name: 'INSERT VALIDATED y DRAFT→VALIDATED rechazados; GUC antiguo no habilita escrituras',
      run: () => {
        const s = seedTenants(url);
        const draftId = id('bundle');
        insertDraftBundle(url, { bundleId: draftId, orgId: s.orgA, version: 1, t: s.t });
        expectFail(
          url,
          `INSERT INTO "CrmReadPolicyBundle"
             ("id","organizationId","version","status","canonicalVersion","contentChecksum",
              "createdAt","updatedAt")
           VALUES ('${id('bundle')}','${s.orgA}',2,'VALIDATED','crm-read-policy-canonical/v1',
             'crm-read-policy-canonical/v1:x','${s.t}','${s.t}');`,
          'direct INSERT VALIDATED',
          /INSERT of VALIDATED bundle blocked/i
        );
        expectFail(
          url,
          `UPDATE "CrmReadPolicyBundle" SET "status"='VALIDATED',
             "contentChecksum"='crm-read-policy-canonical/v1:x', "updatedAt"='${s.t}'
           WHERE "id"='${draftId}';`,
          'DRAFT to VALIDATED update',
          /DRAFT to VALIDATED transition blocked/i
        );
        // Former product bypass must not exist / must not enable writes.
        expectFail(
          url,
          `SELECT set_config('crm_read_policy.allow_validated_snapshot_write', 'on', true);
           INSERT INTO "CrmReadPolicyBundle"
             ("id","organizationId","version","status","canonicalVersion","contentChecksum",
              "createdAt","updatedAt")
           VALUES ('${id('bundle')}','${s.orgA}',3,'VALIDATED','crm-read-policy-canonical/v1',
             'crm-read-policy-canonical/v1:x','${s.t}','${s.t}');`,
          'legacy GUC cannot enable VALIDATED insert',
          /INSERT of VALIDATED bundle blocked/i
        );
        assert(
          psql(
            url,
            `SELECT COUNT(*)::text FROM pg_proc
             WHERE proname='crm_read_policy_allow_validated_snapshot_write';`
          ) === '0',
          'bypass function must remain absent'
        );
      },
    },
    {
      name: 'UPDATE que traslada hijos/evidencia fuera de VALIDATED se rechaza',
      run: () => {
        const s = seedTenants(url);
        const validatedId = id('bundle');
        const draftId = id('bundle');
        const evidenceId = id('evrow');
        const draftLater = id('bundle');
        insertDraftBundle(url, { bundleId: draftId, orgId: s.orgA, version: 1, t: s.t });
        privilegedInsertValidatedFixture(url, {
          bundleId: validatedId,
          orgId: s.orgA,
          version: 2,
          memId: s.memA,
          t: s.t,
          withGrant: true,
          withRetired: true,
          evidence: { id: evidenceId, evidenceId: 'ev_locked', fromVersion: 1, toVersion: 2 },
        });
        insertDraftBundle(url, {
          bundleId: draftLater,
          orgId: s.orgA,
          version: 3,
          predecessorVersion: 1,
          t: s.t,
        });

        expectFail(
          url,
          `UPDATE "CrmReadPolicyRetiredGrantLogicalId"
           SET "bundleId"='${draftId}'
           WHERE "organizationId"='${s.orgA}' AND "bundleId"='${validatedId}' AND "logicalId"='g_retired';`,
          'move retired id from VALIDATED to DRAFT',
          /origin on VALIDATED|immutable/i
        );
        expectFail(
          url,
          `UPDATE "CrmReadPolicyGrant"
           SET "bundleId"='${draftId}', "updatedAt"='${s.t}'
           WHERE "organizationId"='${s.orgA}' AND "bundleId"='${validatedId}' AND "versionId"='gv_locked';`,
          'move grant from VALIDATED to DRAFT',
          /origin on VALIDATED|immutable/i
        );
        expectFail(
          url,
          `UPDATE "CrmReadPolicyChangeEvidence"
           SET "fromVersion"=1, "toVersion"=3
           WHERE "id"='${evidenceId}';`,
          'rewrite evidence away from VALIDATED endpoint onto DRAFT pair',
          /origin tied to VALIDATED|immutable/i
        );
      },
    },
    {
      name: 'escrituras hacia VALIDATED se rechazan',
      run: () => {
        const s = seedTenants(url);
        const validatedId = id('bundle');
        const draftId = id('bundle');
        insertDraftBundle(url, { bundleId: draftId, orgId: s.orgA, version: 1, t: s.t });
        privilegedInsertValidatedFixture(url, {
          bundleId: validatedId,
          orgId: s.orgA,
          version: 2,
          memId: s.memA,
          t: s.t,
          withGrant: true,
        });
        // Seed a grant on draft, then try to move it onto validated.
        psql(
          url,
          `INSERT INTO "CrmReadPolicyGrant"
             ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind",
              "originKind","originOrganizationId","originRootValidated","createdAt","updatedAt")
           VALUES ('${s.orgA}','${draftId}','gv_draft','g_draft','${s.memA}','COMPANY',
              'LEGACY_SNAPSHOT','${s.orgA}',true,'${s.t}','${s.t}');`
        );
        expectFail(
          url,
          `UPDATE "CrmReadPolicyGrant"
           SET "bundleId"='${validatedId}', "updatedAt"='${s.t}'
           WHERE "bundleId"='${draftId}' AND "versionId"='gv_draft';`,
          'move grant from DRAFT onto VALIDATED',
          /destination on VALIDATED|immutable/i
        );
        expectFail(
          url,
          `INSERT INTO "CrmReadPolicyGrant"
             ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind",
              "originKind","originOrganizationId","originRootValidated","createdAt","updatedAt")
           VALUES ('${s.orgA}','${validatedId}','gv_new','g_new','${s.memA}','COMPANY',
              'LEGACY_SNAPSHOT','${s.orgA}',true,'${s.t}','${s.t}');`,
          'insert grant into VALIDATED',
          /destination on VALIDATED|immutable/i
        );
        expectFail(
          url,
          `UPDATE "CrmReadPolicyBundle" SET "contentChecksum"='tampered', "updatedAt"='${s.t}'
           WHERE "id"='${validatedId}';`,
          'update validated bundle header',
          /immutable/i
        );
        expectFail(
          url,
          `DELETE FROM "CrmReadPolicyBundle" WHERE "id"='${validatedId}';`,
          'delete validated bundle',
          /immutable/i
        );
        expectFail(
          url,
          `SELECT set_config('crm_read_policy.allow_validated_snapshot_write', 'on', true);
           INSERT INTO "CrmReadPolicyGrant"
             ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind",
              "originKind","originOrganizationId","originRootValidated","createdAt","updatedAt")
           VALUES ('${s.orgA}','${validatedId}','gv_guc','g_guc','${s.memA}','COMPANY',
              'LEGACY_SNAPSHOT','${s.orgA}',true,'${s.t}','${s.t}');`,
          'legacy GUC cannot insert child into VALIDATED',
          /destination on VALIDATED|immutable/i
        );
      },
    },
    {
      name: 'roles de cliente: hardening elimina privilegios previos (sin REVOKE post-migración)',
      run: () => {
        // Outer loop already reset public. Manage migrate path here:
        // 1) create client roles BEFORE hardening
        // 2) deploy through 4A-1B tables only
        // 3) simulate prior client grants and confirm they exist
        // 4) apply real hardening migration
        // 5) assert migration removed privs — no test-side REVOKE/GRANT after step 4
        ensureClientRoles(url);
        const pre = deployMigrationPrefix(env, [
          BASELINE_NAME,
          SLICE0_NAME,
          POINT8B1_NAME,
          POINT8B6_NAME,
          POINT8_4A1B_NAME,
        ]);
        assert(pre.includes(POINT8_4A1B_NAME), 'pre-hardening deploy must create policy tables');
        assert(
          !pre.includes(`Applying migration \`${POINT8_4A1B_HARDENING_NAME}\``),
          'hardening must not apply before privilege simulation'
        );

        grantSimulatedClientPrivileges(url);
        assertClientPrivilegesPresent(url, 'before hardening');

        const harden = runPrisma(['migrate', 'deploy'], env);
        assert(
          harden.includes(POINT8_4A1B_HARDENING_NAME),
          'corrective hardening migration must apply'
        );

        // No REVOKE / GRANT / security DDL from the test after migrate.
        assertClientPrivilegesAbsent(url, 'after hardening migration alone');

        const s = seedTenants(url);
        const b = id('bundle');
        insertDraftBundle(url, { bundleId: b, orgId: s.orgA, version: 1, t: s.t });

        const deny = /permission denied|does not exist/i;
        for (const role of CLIENT_ROLES) {
          expectFail(
            url,
            `SET ROLE ${role}; SELECT COUNT(*) FROM public."CrmReadPolicyBundle"; RESET ROLE;`,
            `${role} SELECT after hardening`,
            deny
          );
          expectFail(
            url,
            `SET ROLE ${role}; TRUNCATE public."CrmReadPolicyBundle"; RESET ROLE;`,
            `${role} TRUNCATE after hardening`,
            deny
          );
          expectFail(
            url,
            `SET ROLE ${role}; DELETE FROM public."CrmReadPolicyBundle"; RESET ROLE;`,
            `${role} DELETE after hardening`,
            deny
          );
        }

        for (const table of POLICY_TABLES) {
          assert(
            psql(
              url,
              `SELECT relrowsecurity::text FROM pg_class
               WHERE relname='${table}' AND relnamespace='public'::regnamespace;`
            ) === 'true',
            `RLS must be enabled on ${table}`
          );
          assert(
            psql(
              url,
              `SELECT COUNT(*)::text FROM pg_policies
               WHERE schemaname='public' AND tablename='${table}';`
            ) === '0',
            `${table} must have no permissive client policies`
          );
        }
      },
    },
    {
      name: 'sensibilidad: sin hardening el test detecta privilegios de cliente incorrectos',
      run: () => {
        ensureClientRoles(url);
        const pre = deployMigrationPrefix(env, [
          BASELINE_NAME,
          SLICE0_NAME,
          POINT8B1_NAME,
          POINT8B6_NAME,
          POINT8_4A1B_NAME,
        ]);
        assert(pre.includes(POINT8_4A1B_NAME), 'tables must exist for sensitivity fixture');
        assert(
          !pre.includes(`Applying migration \`${POINT8_4A1B_HARDENING_NAME}\``),
          'sensitivity fixture must omit hardening'
        );

        grantSimulatedClientPrivileges(url);
        assertClientPrivilegesPresent(url, 'sensitivity fixture');

        let detected = false;
        let detail = '';
        try {
          assertClientPrivilegesAbsent(url, 'sensitivity expects failure');
        } catch (err) {
          detected = true;
          detail = err instanceof Error ? err.message : String(err);
        }
        assert(detected, 'without hardening, privilege-absence assertion must fail');
        assert(
          /must lack DML\/TRUNCATE|after hardening/i.test(detail),
          `sensitivity message mismatch: ${detail.slice(0, 300)}`
        );

        // Positive control: client role can still SELECT before hardening.
        const probe = psql(
          url,
          `SET ROLE anon; SELECT COUNT(*)::text FROM public."CrmReadPolicyBundle"; RESET ROLE;`
        );
        const countLine = probe
          .split(/\n/)
          .map((line) => line.trim())
          .find((line) => /^\d+$/.test(line));
        assert(
          countLine !== undefined,
          `anon SELECT should succeed without hardening, got ${JSON.stringify(probe)}`
        );
      },
    },
    {
      name: 'relaciones cruzadas, duplicados, scopes y RESTRICT',
      run: () => {
        const s = seedTenants(url);
        const b = id('bundle');
        insertDraftBundle(url, { bundleId: b, orgId: s.orgA, version: 1, t: s.t });
        expectFail(
          url,
          `INSERT INTO "CrmReadPolicyGrant"
             ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind",
              "originKind","originOrganizationId","originRootValidated","createdAt","updatedAt")
           VALUES ('${s.orgA}','${b}','gv1','g1','${s.memB}','COMPANY',
              'LEGACY_SNAPSHOT','${s.orgA}',true,'${s.t}','${s.t}');`,
          'cross-org membership on grant',
          /foreign key|membershipId/i
        );
        expectFail(
          url,
          `INSERT INTO "CrmReadPolicyGrant"
             ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind","scopeLeadId",
              "originKind","originOrganizationId","originRootValidated","createdAt","updatedAt")
           VALUES ('${s.orgA}','${b}','gv2','g2','${s.memA}','RECORD','${s.leadB}',
              'LEGACY_SNAPSHOT','${s.orgA}',true,'${s.t}','${s.t}');`,
          'cross-org lead on grant',
          /foreign key|scopeLeadId/i
        );
        expectFail(
          url,
          `INSERT INTO "CrmReadPolicyBundle"
             ("id","organizationId","version","status","canonicalVersion","contentChecksum",
              "predecessorOrganizationId","predecessorVersion","createdAt","updatedAt")
           VALUES ('${id('bundle')}','${s.orgA}',2,'DRAFT','crm-read-policy-canonical/v1',NULL,
              '${s.orgB}',1,'${s.t}','${s.t}');`,
          'cross-org predecessor',
          /predecessor_pair|check constraint/i
        );
        expectFail(
          url,
          `INSERT INTO "CrmReadPolicyBundle"
             ("id","organizationId","version","status","canonicalVersion","createdAt","updatedAt")
           VALUES ('${id('bundle')}','${s.orgA}',1,'DRAFT','crm-read-policy-canonical/v1','${s.t}','${s.t}');`,
          'duplicate version per org',
          /unique|organizationId_version/i
        );
        expectFail(
          url,
          `INSERT INTO "CrmReadPolicyBundle"
             ("id","organizationId","version","status","canonicalVersion","createdAt","updatedAt")
           VALUES ('${id('bundle')}','${s.orgA}',0,'DRAFT','crm-read-policy-canonical/v1','${s.t}','${s.t}');`,
          'non-positive version',
          /version_positive|check constraint/i
        );
        psql(
          url,
          `INSERT INTO "CrmReadPolicyGrant"
             ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind",
              "originKind","originOrganizationId","originRootValidated","createdAt","updatedAt")
           VALUES ('${s.orgA}','${b}','gv1','g1','${s.memA}','COMPANY',
              'LEGACY_SNAPSHOT','${s.orgA}',true,'${s.t}','${s.t}');`
        );
        expectFail(
          url,
          `INSERT INTO "CrmReadPolicyGrant"
             ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind",
              "originKind","originOrganizationId","originRootValidated","createdAt","updatedAt")
           VALUES ('${s.orgA}','${b}','gv_dup','g1','${s.memA}','COMPANY',
              'LEGACY_SNAPSHOT','${s.orgA}',true,'${s.t}','${s.t}');`,
          'duplicate logicalId',
          /unique|logicalId/i
        );
        expectFail(
          url,
          `INSERT INTO "CrmReadPolicyGrant"
             ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind","scopeLeadId",
              "originKind","originOrganizationId","originRootValidated","createdAt","updatedAt")
           VALUES ('${s.orgA}','${b}','gv3','g3','${s.memA}','COMPANY','${s.leadA}',
              'LEGACY_SNAPSHOT','${s.orgA}',true,'${s.t}','${s.t}');`,
          'COMPANY with lead',
          /scope_shape|check constraint/i
        );
        expectFail(
          url,
          `INSERT INTO "CrmReadPolicyGrant"
             ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind","scopeLeadId",
              "originKind","originOrganizationId","originRootValidated","createdAt","updatedAt")
           VALUES ('${s.orgA}','${b}','gv4','g4','${s.memA}','RECORD',NULL,
              'LEGACY_SNAPSHOT','${s.orgA}',true,'${s.t}','${s.t}');`,
          'RECORD without lead',
          /scope_shape|check constraint/i
        );
        expectFail(
          url,
          `DELETE FROM "Membership" WHERE "id"='${s.memA}';`,
          'membership delete while grant references it',
          /foreign key|restrict|Membership/i
        );
        assert(
          psql(url, `SELECT COUNT(*)::text FROM "CrmReadPolicyGrant" WHERE "bundleId"='${b}';`) ===
            '1',
          'grant must remain after failed membership delete'
        );
        psql(url, `UPDATE "Membership" SET "status"='REMOVED' WHERE "id"='${s.memA}';`);
      },
    },
    {
      name: 'padres cruzados entre bundles se rechazan',
      run: () => {
        const s = seedTenants(url);
        const b1 = id('bundle');
        const b2 = id('bundle');
        insertDraftBundle(url, { bundleId: b1, orgId: s.orgA, version: 1, t: s.t });
        insertDraftBundle(url, {
          bundleId: b2,
          orgId: s.orgA,
          version: 2,
          predecessorVersion: 1,
          t: s.t,
        });
        psql(
          url,
          `INSERT INTO "CrmReadPolicyGrant"
             ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind",
              "originKind","originOrganizationId","originRootValidated","createdAt","updatedAt")
           VALUES ('${s.orgA}','${b1}','gv_root','g1','${s.memA}','COMPANY',
              'LEGACY_SNAPSHOT','${s.orgA}',true,'${s.t}','${s.t}');`
        );
        expectFail(
          url,
          `INSERT INTO "CrmReadPolicyGrant"
             ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind","parentVersionId",
              "originKind","originOrganizationId","originRootValidated","createdAt","updatedAt")
           VALUES ('${s.orgA}','${b2}','gv_child','g2','${s.memA}','COMPANY','gv_root',
              'LEGACY_SNAPSHOT','${s.orgA}',true,'${s.t}','${s.t}');`,
          'parent from other bundle',
          /foreign key|parentVersionId/i
        );
      },
    },
    {
      name: 'actualización desde esquema anterior con datos sintéticos',
      run: () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexora-point8-4a1b-upgrade-'));
        try {
          const prismaDir = path.join(tmp, 'prisma');
          const migrationsDir = path.join(prismaDir, 'migrations');
          fs.mkdirSync(migrationsDir, { recursive: true });
          fs.copyFileSync(
            path.join(repoRoot(), 'prisma', 'schema.prisma'),
            path.join(prismaDir, 'schema.prisma')
          );
          fs.copyFileSync(
            path.join(repoRoot(), 'prisma', 'migrations', 'migration_lock.toml'),
            path.join(migrationsDir, 'migration_lock.toml')
          );
          for (const name of [BASELINE_NAME, SLICE0_NAME, POINT8B1_NAME, POINT8B6_NAME]) {
            fs.cpSync(
              path.join(repoRoot(), 'prisma', 'migrations', name),
              path.join(migrationsDir, name),
              { recursive: true }
            );
          }
          resetPublic(url);
          const pre = runPrisma(
            ['migrate', 'deploy', '--schema', path.join(prismaDir, 'schema.prisma')],
            env
          );
          assert(pre.includes(POINT8B6_NAME), 'pre-4A-1B chain must apply through 8B-6');
          assert(
            !pre.includes(`Applying migration \`${POINT8_4A1B_NAME}\``),
            'upgrade fixture must not include 4A-1B yet'
          );
          const s = seedTenants(url);
          const orgCountBefore = psql(url, `SELECT COUNT(*)::text FROM "Organization";`);
          assert(orgCountBefore === '2', 'synthetic orgs present before 4A-1B');

          const upgrade = runPrisma(['migrate', 'deploy'], env);
          assert(upgrade.includes(POINT8_4A1B_NAME), '4A-1B must apply on upgrade');
          assert(upgrade.includes(POINT8_4A1B_HARDENING_NAME), 'hardening must apply on upgrade');
          assert(
            psql(url, `SELECT COUNT(*)::text FROM "Organization";`) === orgCountBefore,
            'upgrade must preserve synthetic org rows'
          );
          const b = id('bundle');
          insertDraftBundle(url, { bundleId: b, orgId: s.orgA, version: 1, t: s.t });
          assert(
            psql(
              url,
              `SELECT COUNT(*)::text FROM information_schema.tables
               WHERE table_schema='public' AND table_name='CrmReadPolicyBundle';`
            ) === '1',
            'CrmReadPolicyBundle must exist after upgrade'
          );
          assert(
            psql(
              url,
              `SELECT relrowsecurity::text FROM pg_class
               WHERE relname='CrmReadPolicyBundle' AND relnamespace='public'::regnamespace;`
            ) === 'true',
            'RLS enabled after upgrade path'
          );
        } finally {
          fs.rmSync(tmp, { recursive: true, force: true });
        }
      },
    },
  ];

  const selfManagedMigrate = new Set([
    'actualización desde esquema anterior con datos sintéticos',
    'roles de cliente: hardening elimina privilegios previos (sin REVOKE post-migración)',
    'sensibilidad: sin hardening el test detecta privilegios de cliente incorrectos',
  ]);

  let failed = 0;
  for (const scenario of scenarios) {
    try {
      resetPublic(url);
      if (!selfManagedMigrate.has(scenario.name)) {
        runPrisma(['migrate', 'deploy'], env);
      }
      scenario.run();
      console.log(`ok  ${scenario.name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${scenario.name}`);
      console.error(error);
    }
  }

  if (failed > 0) {
    console.error(`${failed} scenario(s) failed`);
    process.exit(1);
  }

  console.log(`${scenarios.length} scenarios passed`);
  console.log('[point8-4a1b] PASS');
}

try {
  main();
} catch (err) {
  console.error('[point8-4a1b] FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
}
