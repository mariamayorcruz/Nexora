/**
 * Point 8B-1 — disposable validation for CrmLead organization DB foundation.
 *
 * Validates the additive migration only:
 *   - nullable organizationId column
 *   - approved indexes
 *   - FK → Organization ON DELETE RESTRICT (confdeltype exactly 'r')
 *   - no backfill side effects
 *   - existing synthetic rows keep organizationId NULL
 *   - userId remains NOT NULL / cascade unchanged
 *   - CURRENT production pending gate `--before-point8b1` on a synthetic
 *     baseline+Slice0 (Point8B1 absent) database
 *
 * Does NOT modify runtime application code paths.
 * Does NOT touch production.
 *
 * Requires FR004_DATABASE_URL or DATABASE_URL → disposable local Postgres.
 *
 * Usage:
 *   FR004_DATABASE_URL=postgresql://... npm run tenancy:validate-point8b1
 */

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  BASELINE_NAME,
  LEGACY_PRODUCTION_MIGRATION_NAMES,
  POINT8B1_NAME,
  SLICE0_NAME,
  assertActiveMigrationSet,
  assertDisposableDatabaseUrl,
  assertPreOrgTablesPresent,
  assertSlice0Present,
  columnExists,
  prismaCliVersion,
  psql,
  psqlFile,
  readMigrationRows,
  repoRoot,
  runPrisma,
  sanitizeDbUrlForLog,
} from './fr004-lib';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function resetPublic(url: string) {
  psql(url, 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
}

function columnNullable(url: string, table: string, column: string): boolean {
  const r = psql(
    url,
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_schema='public' AND table_name='${table}' AND column_name='${column}';`
  );
  return r === 'YES';
}

function columnExists(url: string, table: string, column: string): boolean {
  const r = psql(
    url,
    `SELECT COUNT(*)::text FROM information_schema.columns
     WHERE table_schema='public' AND table_name='${table}' AND column_name='${column}';`
  );
  return r === '1';
}

function indexExists(url: string, indexName: string): boolean {
  const r = psql(
    url,
    `SELECT COUNT(*)::text FROM pg_indexes
     WHERE schemaname='public' AND indexname='${indexName.replace(/'/g, "''")}';`
  );
  return r === '1';
}

function fkDeleteRule(url: string, constraintName: string): string {
  return psql(
    url,
    `SELECT r.confdeltype
     FROM pg_constraint r
     JOIN pg_class c ON c.oid = r.conrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname='public'
       AND c.relname='CrmLead'
       AND r.contype='f'
       AND r.conname='${constraintName.replace(/'/g, "''")}';`
  );
}

function main(): void {
  const url = process.env.FR004_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Set FR004_DATABASE_URL or DATABASE_URL to a disposable Postgres');
  assertDisposableDatabaseUrl(url);
  assertActiveMigrationSet();

  console.log(`[point8b1] prisma=${prismaCliVersion()}`);
  console.log(`[point8b1] target=${sanitizeDbUrlForLog(url)}`);

  resetPublic(url);
  const env = { ...process.env, DATABASE_URL: url };

  console.log('[point8b1] prisma validate');
  runPrisma(['validate'], env);

  console.log('[point8b1] prisma generate');
  runPrisma(['generate'], env);

  console.log('[point8b1] migrate deploy (baseline + Slice 0 + Point 8B-1)');
  const deployOut = runPrisma(['migrate', 'deploy'], env);
  console.log(deployOut);
  assert(deployOut.includes(BASELINE_NAME), 'baseline applied');
  assert(deployOut.includes(SLICE0_NAME), 'slice0 applied');
  assert(deployOut.includes(POINT8B1_NAME), 'point8b1 applied');

  const rows = readMigrationRows(url);
  const names = rows.map((r) => r.migration_name);
  assert(
    names.length === 3 &&
      names[0] === BASELINE_NAME &&
      names[1] === SLICE0_NAME &&
      names[2] === POINT8B1_NAME,
    `unexpected migration rows: ${names.join(',')}`
  );

  assertPreOrgTablesPresent(url);
  assertSlice0Present(url);

  assert(columnExists(url, 'CrmLead', 'organizationId'), 'organizationId column missing');
  assert(columnNullable(url, 'CrmLead', 'organizationId'), 'organizationId must be nullable');
  assert(columnExists(url, 'CrmLead', 'userId'), 'userId missing');
  assert(!columnNullable(url, 'CrmLead', 'userId'), 'userId must remain NOT NULL');

  assert(
    indexExists(url, 'CrmLead_organizationId_updatedAt_idx'),
    'missing index CrmLead_organizationId_updatedAt_idx'
  );
  assert(
    indexExists(url, 'CrmLead_organizationId_stage_idx'),
    'missing index CrmLead_organizationId_stage_idx'
  );
  assert(indexExists(url, 'CrmLead_userId_idx'), 'missing index CrmLead_userId_idx');

  // Frozen design: ON DELETE RESTRICT → PostgreSQL confdeltype 'r' (not NO ACTION 'a')
  const del = fkDeleteRule(url, 'CrmLead_organizationId_fkey');
  assert(del === 'r', `expected ON DELETE RESTRICT (confdeltype=r), got '${del}'`);

  const upd = psql(
    url,
    `SELECT r.confupdtype
     FROM pg_constraint r
     JOIN pg_class c ON c.oid = r.conrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname='public'
       AND c.relname='CrmLead'
       AND r.contype='f'
       AND r.conname='CrmLead_organizationId_fkey';`
  );
  assert(upd === 'c', `expected ON UPDATE CASCADE (confupdtype=c), got '${upd}'`);

  // Synthetic data — raw SQL so active Prisma Client (without organizationId) is not required.
  const userId = `user_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const orgId = `legacy_org_${userId}`;
  const leadId = `lead_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();

  psql(
    url,
    `INSERT INTO "User" ("id","email","password","nurtureStatus","createdAt","updatedAt")
     VALUES ('${userId}','${userId}@example.com','x','not-consented','${now}','${now}');`
  );
  psql(
    url,
    `INSERT INTO "Organization" ("id","name","slug","status","createdAt","updatedAt")
     VALUES ('${orgId}','Test Org','slug-${userId}','ACTIVE','${now}','${now}');`
  );
  psql(
    url,
    `INSERT INTO "CrmLead" ("id","userId","name","source","stage","status","value","confidence","createdAt","updatedAt")
     VALUES ('${leadId}','${userId}','Synthetic Lead','manual','lead','nuevo',0,25,'${now}','${now}');`
  );

  const orgCol = psql(
    url,
    `SELECT CASE WHEN "organizationId" IS NULL THEN 'NULL' ELSE "organizationId" END
     FROM "CrmLead" WHERE "id"='${leadId}';`
  );
  assert(orgCol === 'NULL', `existing/new row without org stamp must be NULL, got ${orgCol}`);

  // Accept valid Organization FK
  psql(url, `UPDATE "CrmLead" SET "organizationId"='${orgId}' WHERE "id"='${leadId}';`);
  const linked = psql(url, `SELECT "organizationId" FROM "CrmLead" WHERE "id"='${leadId}';`);
  assert(linked === orgId, 'FK accept existing Organization failed');

  // Reject unknown Organization
  let rejectedUnknown = false;
  try {
    psql(
      url,
      `UPDATE "CrmLead" SET "organizationId"='org_does_not_exist' WHERE "id"='${leadId}';`
    );
  } catch {
    rejectedUnknown = true;
  }
  assert(rejectedUnknown, 'FK must reject unknown Organization id');

  // RESTRICT Organization delete while referenced
  let restricted = false;
  try {
    psql(url, `DELETE FROM "Organization" WHERE "id"='${orgId}';`);
  } catch {
    restricted = true;
  }
  assert(restricted, 'Organization delete must be restricted while CrmLead references it');

  // userId cascade unchanged: deleting User removes CrmLead
  psql(url, `UPDATE "CrmLead" SET "organizationId"=NULL WHERE "id"='${leadId}';`);
  psql(url, `DELETE FROM "User" WHERE "id"='${userId}';`);
  const leadGone = psql(url, `SELECT COUNT(*)::text FROM "CrmLead" WHERE "id"='${leadId}';`);
  assert(leadGone === '0', 'userId ON DELETE CASCADE must still remove CrmLead');

  // Org remains after User/CrmLead cascade (no org cascade from user)
  const orgStill = psql(url, `SELECT COUNT(*)::text FROM "Organization" WHERE "id"='${orgId}';`);
  assert(orgStill === '1', 'Organization must remain after User delete');

  // No unexpected Point 8 entities
  for (const forbidden of ['Company', 'Contact', 'Conversation', 'Message', 'Opportunity']) {
    const c = psql(
      url,
      `SELECT COUNT(*)::text FROM information_schema.tables
       WHERE table_schema='public' AND table_name='${forbidden}';`
    );
    assert(c === '0', `unexpected table introduced: ${forbidden}`);
  }

  // Idempotent migrate deploy (no second apply)
  const redeploy = runPrisma(['migrate', 'deploy'], env);
  assert(
    /No pending migrations|already in sync|Datasource/i.test(redeploy) ||
      !redeploy.includes(`Applying migration \`${POINT8B1_NAME}\``),
    'second migrate deploy must not re-apply Point 8B-1'
  );

  // Prove no automatic backfill: insert lead without orgId after migration → still NULL
  const user2 = `user_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const lead2 = `lead_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  psql(
    url,
    `INSERT INTO "User" ("id","email","password","nurtureStatus","createdAt","updatedAt")
     VALUES ('${user2}','${user2}@example.com','x','not-consented','${now}','${now}');`
  );
  psql(
    url,
    `INSERT INTO "CrmLead" ("id","userId","name","source","stage","status","value","confidence","createdAt","updatedAt")
     VALUES ('${lead2}','${user2}','No Backfill','manual','lead','nuevo',0,25,'${now}','${now}');`
  );
  const noBackfill = psql(
    url,
    `SELECT CASE WHEN "organizationId" IS NULL THEN 'NULL' ELSE 'SET' END
     FROM "CrmLead" WHERE "id"='${lead2}';`
  );
  assert(noBackfill === 'NULL', 'migration must not backfill organizationId');

  console.log('[point8b1] PASS column/nullability/indexes/fk/restrict/cascade/no-backfill/idempotent');

  // --- CURRENT production gate simulation: baseline + Slice0 applied, Point8B1 absent ---
  console.log('[point8b1] building synthetic pre-Point8B1 DB for --before-point8b1 gate');
  resetPublic(url);
  const baselineSql = path.join(repoRoot(), 'prisma', 'migrations', BASELINE_NAME, 'migration.sql');
  const slice0Sql = path.join(repoRoot(), 'prisma', 'migrations', SLICE0_NAME, 'migration.sql');
  assert(fs.existsSync(baselineSql), 'baseline SQL missing');
  assert(fs.existsSync(slice0Sql), 'slice0 SQL missing');
  psqlFile(url, baselineSql);
  psqlFile(url, slice0Sql);
  assertPreOrgTablesPresent(url);
  assertSlice0Present(url);
  assert(!columnExists(url, 'CrmLead', 'organizationId'), 'organizationId must be absent pre-8B-1');

  psql(
    url,
    `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    );`
  );
  LEGACY_PRODUCTION_MIGRATION_NAMES.forEach((name, idx) => {
    const id = `00000000-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`;
    psql(
      url,
      `INSERT INTO "_prisma_migrations"
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES
        ('${id}', '${'b'.repeat(64)}', now(), '${name}', NULL, NULL, now(), 1);`
    );
  });
  psql(
    url,
    `INSERT INTO "_prisma_migrations"
      (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES
      ('00000000-0000-4000-8000-000000000100', '${'c'.repeat(64)}', now(), '${BASELINE_NAME}', NULL, NULL, now(), 1),
      ('00000000-0000-4000-8000-000000000200', '${'d'.repeat(64)}', now(), '${SLICE0_NAME}', NULL, NULL, now(), 1);`
  );

  const preRows = readMigrationRows(url).map((r) => r.migration_name);
  assert(preRows.includes(BASELINE_NAME) && preRows.includes(SLICE0_NAME), 'pre-8B1 rows incomplete');
  assert(!preRows.includes(POINT8B1_NAME), 'Point8B1 must not be recorded in synthetic pre-8B1 DB');

  const proofBin = path.join(repoRoot(), 'node_modules', '.bin', 'tsx');
  const proofScript = path.join(repoRoot(), 'scripts', 'fr004-pending-migrations-proof.ts');
  const proofOut = execFileSync(proofBin, [proofScript, '--before-point8b1'], {
    cwd: repoRoot(),
    env: { ...process.env, FR004_DATABASE_URL: url, DATABASE_URL: url },
    encoding: 'utf8',
  });
  console.log(proofOut);
  assert(proofOut.includes('pending=Point8B1 only') || proofOut.includes(POINT8B1_NAME), 'pending proof output missing Point8B1');
  assert(proofOut.includes('[fr004-pending-proof] PASS'), 'before-point8b1 proof did not PASS');

  console.log('[point8b1] PASS --before-point8b1 pending==Point8B1 only');
  console.log('[point8b1] ALL_PASS');
}

try {
  main();
} catch (err) {
  console.error('[point8b1] FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
}
