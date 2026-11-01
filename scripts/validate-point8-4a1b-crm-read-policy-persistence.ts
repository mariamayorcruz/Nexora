/**
 * Point 8 step 4A-1B — disposable Postgres validation for inactive CRM
 * read-policy candidate persistence.
 *
 * Contract reference (fixed): PR #23 HEAD
 *   02c8a573b967d7656c8f5e057003b49ae214d0c5
 * Pure validators live on that PR and are NOT imported or duplicated here.
 * This script exercises real database constraints only.
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
    status?: 'DRAFT' | 'VALIDATED';
    predecessorVersion?: number | null;
    t: string;
  }
) {
  const status = opts.status || 'DRAFT';
  const checksum =
    opts.checksum === undefined
      ? status === 'VALIDATED'
        ? 'crm-read-policy-canonical/v1:fixture'
        : null
      : opts.checksum;
  const predOrg = opts.predecessorVersion == null ? 'NULL' : `'${opts.orgId}'`;
  const predVer = opts.predecessorVersion == null ? 'NULL' : String(opts.predecessorVersion);
  const checksumSql = checksum == null ? 'NULL' : `'${checksum}'`;
  psql(
    url,
    `INSERT INTO "CrmReadPolicyBundle"
      ("id","organizationId","version","status","canonicalVersion","contentChecksum",
       "predecessorOrganizationId","predecessorVersion","createdAt","updatedAt")
     VALUES
      ('${opts.bundleId}','${opts.orgId}',${opts.version},'${status}',
       'crm-read-policy-canonical/v1',${checksumSql},${predOrg},${predVer},'${opts.t}','${opts.t}');`
  );
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

  const env = { ...process.env, DATABASE_URL: url };
  console.log('[point8-4a1b] prisma validate');
  runPrisma(['validate'], env);
  console.log('[point8-4a1b] prisma generate');
  runPrisma(['generate'], env);

  // --- Greenfield apply ---
  resetPublic(url);
  console.log('[point8-4a1b] migrate deploy from empty schema');
  const deployOut = runPrisma(['migrate', 'deploy'], env);
  assert(deployOut.includes(POINT8_4A1B_NAME), '4A-1B migration must apply');
  const names = readMigrationRows(url).map((r) => r.migration_name);
  assert(
    names.length === 5 &&
      names[0] === BASELINE_NAME &&
      names[1] === SLICE0_NAME &&
      names[2] === POINT8B1_NAME &&
      names[3] === POINT8B6_NAME &&
      names[4] === POINT8_4A1B_NAME,
    `unexpected migration rows: ${names.join(',')}`
  );

  const scenarios: Scenario[] = [
    {
      name: 'inserción válida de bundle vacío, grant, retired ids y evidencia',
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

        // Empty candidate catalogs + retired history + grant with parent
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
        const grantCount = psql(
          url,
          `SELECT COUNT(*)::text FROM "CrmReadPolicyGrant" WHERE "bundleId"='${empty}';`
        );
        assert(grantCount === '0', 'empty candidate policy must allow zero grants');
      },
    },
    {
      name: 'relaciones cruzadas entre empresas se rechazan',
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
          /foreign key|CrmReadPolicyGrant_organizationId_membershipId/i
        );
        expectFail(
          url,
          `INSERT INTO "CrmReadPolicyGrant"
             ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind","scopeLeadId",
              "originKind","originOrganizationId","originRootValidated","createdAt","updatedAt")
           VALUES ('${s.orgA}','${b}','gv2','g2','${s.memA}','RECORD','${s.leadB}',
              'LEGACY_SNAPSHOT','${s.orgA}',true,'${s.t}','${s.t}');`,
          'cross-org lead on grant',
          /foreign key|CrmReadPolicyGrant_organizationId_scopeLeadId/i
        );
        expectFail(
          url,
          `INSERT INTO "CrmReadPolicyBundle"
             ("id","organizationId","version","status","canonicalVersion","contentChecksum",
              "predecessorOrganizationId","predecessorVersion","createdAt","updatedAt")
           VALUES ('${id('bundle')}','${s.orgA}',2,'DRAFT','crm-read-policy-canonical/v1',NULL,
              '${s.orgB}',1,'${s.t}','${s.t}');`,
          'cross-org predecessor',
          /CrmReadPolicyBundle_predecessor_pair|check constraint/i
        );
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
      name: 'duplicados y scopes inválidos se rechazan',
      run: () => {
        const s = seedTenants(url);
        const b = id('bundle');
        insertDraftBundle(url, { bundleId: b, orgId: s.orgA, version: 1, t: s.t });
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
           VALUES ('${s.orgA}','${b}','gv2','g1','${s.memA}','COMPANY',
              'LEGACY_SNAPSHOT','${s.orgA}',true,'${s.t}','${s.t}');`,
          'duplicate logicalId in bundle',
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
          `INSERT INTO "CrmReadPolicyGrantFieldClass"
             ("organizationId","bundleId","grantVersionId","fieldClass")
           VALUES ('${s.orgA}','${b}','gv1','IDENTIDAD'), ('${s.orgA}','${b}','gv1','IDENTIDAD');`,
          'duplicate field class',
          /unique|duplicate|pkey/i
        );
        expectFail(
          url,
          `INSERT INTO "CrmReadPolicyRetiredGrantLogicalId"
             ("organizationId","bundleId","logicalId")
           VALUES ('${s.orgA}','${b}','g_x'), ('${s.orgA}','${b}','g_x');`,
          'duplicate retired logicalId',
          /unique|duplicate|pkey/i
        );
        expectFail(
          url,
          `INSERT INTO "CrmReadPolicyGrant"
             ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind",
              "validFrom","validUntil","originKind","originOrganizationId","originRootValidated",
              "createdAt","updatedAt")
           VALUES ('${s.orgA}','${b}','gv5','g5','${s.memA}','COMPANY',
              '2026-02-01T00:00:00.000Z','2026-01-01T00:00:00.000Z',
              'LEGACY_SNAPSHOT','${s.orgA}',true,'${s.t}','${s.t}');`,
          'inverted validity window',
          /window_order|check constraint/i
        );
      },
    },
    {
      name: 'políticas se conservan ante retirada de membresía (DELETE RESTRICT)',
      run: () => {
        const s = seedTenants(url);
        const b = id('bundle');
        insertDraftBundle(url, { bundleId: b, orgId: s.orgA, version: 1, t: s.t });
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
          `DELETE FROM "Membership" WHERE "id"='${s.memA}';`,
          'membership delete while grant references it',
          /foreign key|restrict|Membership/i
        );
        const still = psql(
          url,
          `SELECT COUNT(*)::text FROM "CrmReadPolicyGrant" WHERE "bundleId"='${b}';`
        );
        assert(still === '1', 'grant must remain after failed membership delete');
        // Soft withdrawal remains available
        psql(url, `UPDATE "Membership" SET "status"='REMOVED' WHERE "id"='${s.memA}';`);
        const status = psql(url, `SELECT "status"::text FROM "Membership" WHERE "id"='${s.memA}';`);
        assert(status === 'REMOVED', 'membership status REMOVED must remain available');
      },
    },
    {
      name: 'historial de identidades retiradas se almacena y recupera fielmente',
      run: () => {
        const s = seedTenants(url);
        const b = id('bundle');
        insertDraftBundle(url, { bundleId: b, orgId: s.orgA, version: 1, t: s.t });
        psql(
          url,
          `INSERT INTO "CrmReadPolicyRetiredGrantLogicalId" ("organizationId","bundleId","logicalId") VALUES
             ('${s.orgA}','${b}','g_b'),
             ('${s.orgA}','${b}','g_a');`
        );
        const rows = psql(
          url,
          `SELECT string_agg("logicalId", ',' ORDER BY "logicalId")
           FROM "CrmReadPolicyRetiredGrantLogicalId" WHERE "bundleId"='${b}';`
        );
        assert(rows === 'g_a,g_b', `retired ids round-trip mismatch: ${rows}`);
      },
    },
    {
      name: 'inmutabilidad VALIDATED y bloqueo DRAFT→VALIDATED',
      run: () => {
        const s = seedTenants(url);
        const draftId = id('bundle');
        const validatedId = id('bundle');
        insertDraftBundle(url, { bundleId: draftId, orgId: s.orgA, version: 1, t: s.t });
        expectFail(
          url,
          `UPDATE "CrmReadPolicyBundle" SET "status"='VALIDATED',
             "contentChecksum"='crm-read-policy-canonical/v1:x', "updatedAt"='${s.t}'
           WHERE "id"='${draftId}';`,
          'DRAFT to VALIDATED update',
          /DRAFT to VALIDATED transition blocked|immutable/i
        );

        // Initial validated snapshot write under explicit session guard (future transactional service).
        psql(
          url,
          `SELECT set_config('crm_read_policy.allow_validated_snapshot_write', 'on', true);
           INSERT INTO "CrmReadPolicyBundle"
             ("id","organizationId","version","status","canonicalVersion","contentChecksum",
              "createdAt","updatedAt")
           VALUES ('${validatedId}','${s.orgA}',2,'VALIDATED','crm-read-policy-canonical/v1',
             'crm-read-policy-canonical/v1:validated','${s.t}','${s.t}');
           INSERT INTO "CrmReadPolicyRetiredGrantLogicalId" ("organizationId","bundleId","logicalId")
           VALUES ('${s.orgA}','${validatedId}','g_locked');
           INSERT INTO "CrmReadPolicyGrant"
             ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind",
              "originKind","originOrganizationId","originRootValidated","createdAt","updatedAt")
           VALUES ('${s.orgA}','${validatedId}','gv1','g1','${s.memA}','COMPANY',
              'LEGACY_SNAPSHOT','${s.orgA}',true,'${s.t}','${s.t}');
           SELECT set_config('crm_read_policy.allow_validated_snapshot_write', 'off', true);`
        );

        expectFail(
          url,
          `UPDATE "CrmReadPolicyBundle" SET "contentChecksum"='tampered', "updatedAt"='${s.t}'
           WHERE "id"='${validatedId}';`,
          'update validated bundle',
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
          `INSERT INTO "CrmReadPolicyGrant"
             ("organizationId","bundleId","versionId","logicalId","membershipId","scopeKind",
              "originKind","originOrganizationId","originRootValidated","createdAt","updatedAt")
           VALUES ('${s.orgA}','${validatedId}','gv2','g2','${s.memA}','COMPANY',
              'LEGACY_SNAPSHOT','${s.orgA}',true,'${s.t}','${s.t}');`,
          'insert grant into validated bundle',
          /immutable/i
        );
        expectFail(
          url,
          `UPDATE "CrmReadPolicyGrant" SET "validity"='REVOKED', "updatedAt"='${s.t}'
           WHERE "bundleId"='${validatedId}' AND "versionId"='gv1';`,
          'update grant on validated bundle',
          /immutable/i
        );
        expectFail(
          url,
          `INSERT INTO "CrmReadPolicyBundle"
             ("id","organizationId","version","status","canonicalVersion","contentChecksum",
              "createdAt","updatedAt")
           VALUES ('${id('bundle')}','${s.orgA}',3,'VALIDATED','crm-read-policy-canonical/v1',
             NULL,'${s.t}','${s.t}');`,
          'VALIDATED without checksum',
          /validated_requires_checksum|check constraint/i
        );
      },
    },
    {
      name: 'evidencia no puede vincular versiones de empresas distintas',
      run: () => {
        const s = seedTenants(url);
        const bA = id('bundle');
        const bB = id('bundle');
        insertDraftBundle(url, { bundleId: bA, orgId: s.orgA, version: 1, t: s.t });
        insertDraftBundle(url, { bundleId: bB, orgId: s.orgB, version: 1, t: s.t });
        insertDraftBundle(url, {
          bundleId: id('bundle'),
          orgId: s.orgA,
          version: 2,
          predecessorVersion: 1,
          t: s.t,
        });
        expectFail(
          url,
          `INSERT INTO "CrmReadPolicyChangeEvidence"
             ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind",
              "targetLogicalId","createdAt")
           VALUES ('${id('evrow')}','evx','${s.orgA}',1,1,'ADD_GRANT','g','${s.t}');`,
          'evidence version order',
          /version_order|check constraint/i
        );
        // orgA fromVersion=1 exists; toVersion referring as if orgB's version via wrong org id fails FK
        expectFail(
          url,
          `INSERT INTO "CrmReadPolicyChangeEvidence"
             ("id","evidenceId","organizationId","fromVersion","toVersion","changeKind",
              "targetLogicalId","createdAt")
           VALUES ('${id('evrow')}','evy','${s.orgB}',1,2,'ADD_GRANT','g','${s.t}');`,
          'evidence to missing version in orgB',
          /foreign key|toVersion/i
        );
      },
    },
    {
      name: 'actualización desde esquema anterior con datos sintéticos',
      run: () => {
        // This scenario manages its own migrate path; outer loop still resets first.
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
          const orgCountAfter = psql(url, `SELECT COUNT(*)::text FROM "Organization";`);
          assert(orgCountAfter === orgCountBefore, 'upgrade must preserve synthetic org rows');

          const b = id('bundle');
          insertDraftBundle(url, { bundleId: b, orgId: s.orgA, version: 1, t: s.t });
          const table = psql(
            url,
            `SELECT COUNT(*)::text FROM information_schema.tables
             WHERE table_schema='public' AND table_name='CrmReadPolicyBundle';`
          );
          assert(table === '1', 'CrmReadPolicyBundle must exist after upgrade');
        } finally {
          fs.rmSync(tmp, { recursive: true, force: true });
        }
      },
    },
  ];

  // Isolate each scenario on a clean public schema + full migration chain
  // (upgrade scenario re-manages migrate deploy itself after the shared reset).
  let failed = 0;
  for (const scenario of scenarios) {
    try {
      resetPublic(url);
      if (scenario.name !== 'actualización desde esquema anterior con datos sintéticos') {
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
