/**
 * Point 8B-1 — disposable validation for CrmLead organization DB foundation.
 *
 * Two physical phases, plus the historical pending-gate simulation:
 *   1. Migrations through Point 8B-1 only (temporary copy; repo folder untouched):
 *      nullable organizationId, no backfill, FK RESTRICT, userId cascade.
 *   2. Real prisma/migrations chain, including Point 8B-6 and Point 8C:
 *      organizationId NOT NULL, null insert and SET NULL rejected.
 *      The temporary copy still stops at Point 8B-1 and excludes 8B-6 and 8C.
 *   3. Synthetic baseline+Slice0 DB for `--before-point8b1` (Point 8B-1 absent).
 *
 * Does NOT modify runtime application code, schema, or migration files.
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
import os from 'node:os';
import path from 'node:path';
import {
  BASELINE_NAME,
  LEGACY_PRODUCTION_MIGRATION_NAMES,
  POINT8B1_NAME,
  POINT8B6_NAME,
  POINT8C_NAME,
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

function fkUpdateRule(url: string): string {
  return psql(
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
}

function assertFoundationShape(url: string, organizationIdNullable: boolean) {
  assert(columnExists(url, 'CrmLead', 'organizationId'), 'organizationId column missing');
  assert(
    columnNullable(url, 'CrmLead', 'organizationId') === organizationIdNullable,
    organizationIdNullable
      ? 'organizationId must stay nullable on the Point 8B-1 migration set'
      : 'organizationId must be NOT NULL after the full chain including Point 8B-6'
  );
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
  const del = fkDeleteRule(url, 'CrmLead_organizationId_fkey');
  assert(del === 'r', `expected ON DELETE RESTRICT (confdeltype=r), got '${del}'`);
  const upd = fkUpdateRule(url);
  assert(upd === 'c', `expected ON UPDATE CASCADE (confupdtype=c), got '${upd}'`);
}

function assertNoPoint8Tables(url: string) {
  for (const forbidden of ['Company', 'Contact', 'Conversation', 'Message', 'Opportunity']) {
    const c = psql(
      url,
      `SELECT COUNT(*)::text FROM information_schema.tables
       WHERE table_schema='public' AND table_name='${forbidden}';`
    );
    assert(c === '0', `unexpected table introduced: ${forbidden}`);
  }
}

function expectPsqlFail(url: string, sql: string, label: string, pattern: RegExp) {
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
  assert(pattern.test(out), `${label}: missing fail signal in: ${out.slice(0, 500)}`);
}

/**
 * Deploy baseline + Slice 0 + Point 8B-1 from a temporary migration directory.
 * The repository prisma/migrations folder is only read.
 */
function deployMigrationsThroughPoint8B1(env: NodeJS.ProcessEnv): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexora-point8b1-'));
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
    for (const name of [BASELINE_NAME, SLICE0_NAME, POINT8B1_NAME]) {
      fs.cpSync(
        path.join(repoRoot(), 'prisma', 'migrations', name),
        path.join(migrationsDir, name),
        { recursive: true }
      );
    }
    const copied = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    assert(
      copied.length === 3 &&
        copied[0] === BASELINE_NAME &&
        copied[1] === SLICE0_NAME &&
        copied[2] === POINT8B1_NAME &&
        !copied.includes(POINT8B6_NAME) &&
        !copied.includes(POINT8C_NAME),
      `historical migration sandbox must be exactly through Point 8B-1, got ${copied.join(',')}`
    );
    return runPrisma(
      ['migrate', 'deploy', '--schema', path.join(prismaDir, 'schema.prisma')],
      env
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function insertUser(url: string, userId: string, now: string) {
  psql(
    url,
    `INSERT INTO "User" ("id","email","password","nurtureStatus","createdAt","updatedAt")
     VALUES ('${userId}','${userId}@example.com','x','not-consented','${now}','${now}');`
  );
}

function main(): void {
  const url = process.env.FR004_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Set FR004_DATABASE_URL or DATABASE_URL to a disposable Postgres');
  assertDisposableDatabaseUrl(url);
  assertActiveMigrationSet();

  console.log(`[point8b1] prisma=${prismaCliVersion()}`);
  console.log(`[point8b1] target=${sanitizeDbUrlForLog(url)}`);

  const env = { ...process.env, DATABASE_URL: url };

  console.log('[point8b1] prisma validate');
  runPrisma(['validate'], env);

  console.log('[point8b1] prisma generate');
  runPrisma(['generate'], env);

  // --- Phase 1: historical nullable shape, migrations through Point 8B-1 only ---
  resetPublic(url);
  console.log('[point8b1] migrate deploy through Point 8B-1 only (temporary migration copy)');
  const historicalDeploy = deployMigrationsThroughPoint8B1(env);
  console.log(historicalDeploy);
  assert(historicalDeploy.includes(BASELINE_NAME), 'baseline applied');
  assert(historicalDeploy.includes(SLICE0_NAME), 'slice0 applied');
  assert(historicalDeploy.includes(POINT8B1_NAME), 'point8b1 applied');
  assert(
    !historicalDeploy.includes(`Applying migration \`${POINT8B6_NAME}\``),
    'historical deploy must not apply Point 8B-6'
  );
  assert(
    !historicalDeploy.includes(`Applying migration \`${POINT8C_NAME}\``),
    'historical deploy must not apply Point 8C'
  );
  assertActiveMigrationSet();

  const historicalRows = readMigrationRows(url).map((r) => r.migration_name);
  assert(
    historicalRows.length === 3 &&
      historicalRows[0] === BASELINE_NAME &&
      historicalRows[1] === SLICE0_NAME &&
      historicalRows[2] === POINT8B1_NAME,
    `historical migration rows must stop at Point 8B-1, got ${historicalRows.join(',')}`
  );

  assertPreOrgTablesPresent(url);
  assertSlice0Present(url);
  assertFoundationShape(url, true);

  const userId = `user_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const orgId = `legacy_org_${userId}`;
  const leadId = `lead_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();

  insertUser(url, userId, now);
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

  psql(url, `UPDATE "CrmLead" SET "organizationId"='${orgId}' WHERE "id"='${leadId}';`);
  const linked = psql(url, `SELECT "organizationId" FROM "CrmLead" WHERE "id"='${leadId}';`);
  assert(linked === orgId, 'FK accept existing Organization failed');

  expectPsqlFail(
    url,
    `UPDATE "CrmLead" SET "organizationId"='org_does_not_exist' WHERE "id"='${leadId}';`,
    'unknown Organization FK',
    /violates foreign key|is not present/i
  );

  expectPsqlFail(
    url,
    `DELETE FROM "Organization" WHERE "id"='${orgId}';`,
    'Organization delete while referenced',
    /violates foreign key|restrict|is still referenced/i
  );

  psql(url, `UPDATE "CrmLead" SET "organizationId"=NULL WHERE "id"='${leadId}';`);
  psql(url, `DELETE FROM "User" WHERE "id"='${userId}';`);
  const leadGone = psql(url, `SELECT COUNT(*)::text FROM "CrmLead" WHERE "id"='${leadId}';`);
  assert(leadGone === '0', 'userId ON DELETE CASCADE must still remove CrmLead');
  const orgStill = psql(url, `SELECT COUNT(*)::text FROM "Organization" WHERE "id"='${orgId}';`);
  assert(orgStill === '1', 'Organization must remain after User delete');
  assertNoPoint8Tables(url);

  const historicalRedeploy = deployMigrationsThroughPoint8B1(env);
  assert(
    !historicalRedeploy.includes(`Applying migration \`${POINT8B1_NAME}\``),
    'second historical migrate deploy must not re-apply Point 8B-1'
  );

  const user2 = `user_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const lead2 = `lead_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  insertUser(url, user2, now);
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
  assert(noBackfill === 'NULL', 'Point 8B-1 migration must not backfill organizationId');
  console.log('[point8b1] PASS historical nullable phase through Point 8B-1');

  // --- Phase 2: final chain, organizationId NOT NULL ---
  resetPublic(url);
  console.log('[point8b1] migrate deploy full chain including Point 8B-6');
  const fullDeploy = runPrisma(['migrate', 'deploy'], env);
  console.log(fullDeploy);
  assert(fullDeploy.includes(POINT8B6_NAME), 'point8b6 applied');
  assert(fullDeploy.includes(POINT8C_NAME), 'point8c applied');

  const fullRows = readMigrationRows(url).map((r) => r.migration_name);
  assert(
    fullRows.length === 5 &&
      fullRows[0] === BASELINE_NAME &&
      fullRows[1] === SLICE0_NAME &&
      fullRows[2] === POINT8B1_NAME &&
      fullRows[3] === POINT8B6_NAME &&
      fullRows[4] === POINT8C_NAME,
    `unexpected full-chain migration rows: ${fullRows.join(',')}`
  );
  assertFoundationShape(url, false);
  assertNoPoint8Tables(url);

  const user3 = `user_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const org3 = `legacy_org_${user3}`;
  const lead3 = `lead_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  insertUser(url, user3, now);
  psql(
    url,
    `INSERT INTO "Organization" ("id","name","slug","status","createdAt","updatedAt")
     VALUES ('${org3}','Final Org','slug-${user3}','ACTIVE','${now}','${now}');`
  );
  expectPsqlFail(
    url,
    `INSERT INTO "CrmLead" ("id","userId","name","source","stage","status","value","confidence","createdAt","updatedAt")
     VALUES ('${lead3}','${user3}','Null Rejected','manual','lead','nuevo',0,25,'${now}','${now}');`,
    'INSERT without organizationId',
    /not-null|null value/i
  );
  psql(
    url,
    `INSERT INTO "CrmLead" ("id","userId","organizationId","name","source","stage","status","value","confidence","createdAt","updatedAt")
     VALUES ('${lead3}','${user3}','${org3}','Final Lead','manual','lead','nuevo',0,25,'${now}','${now}');`
  );
  const stamped = psql(url, `SELECT "organizationId" FROM "CrmLead" WHERE "id"='${lead3}';`);
  assert(stamped === org3, 'final NOT NULL row must keep the provided organizationId');
  expectPsqlFail(
    url,
    `UPDATE "CrmLead" SET "organizationId"=NULL WHERE "id"='${lead3}';`,
    'SET organizationId NULL',
    /not-null|null value/i
  );
  expectPsqlFail(
    url,
    `DELETE FROM "Organization" WHERE "id"='${org3}';`,
    'Organization delete while referenced after 8B-6',
    /violates foreign key|restrict|is still referenced/i
  );
  psql(url, `DELETE FROM "User" WHERE "id"='${user3}';`);
  const finalLeadGone = psql(url, `SELECT COUNT(*)::text FROM "CrmLead" WHERE "id"='${lead3}';`);
  assert(finalLeadGone === '0', 'userId ON DELETE CASCADE must still remove CrmLead after 8B-6');
  const finalOrgStill = psql(url, `SELECT COUNT(*)::text FROM "Organization" WHERE "id"='${org3}';`);
  assert(finalOrgStill === '1', 'Organization must remain after User delete on the final chain');

  const fullRedeploy = runPrisma(['migrate', 'deploy'], env);
  assert(
    !fullRedeploy.includes('Applying migration'),
    'second full migrate deploy must not re-apply any migration'
  );
  assertFoundationShape(url, false);
  console.log('[point8b1] PASS final NOT NULL phase');

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
  const proofEnv = { ...process.env, FR004_DATABASE_URL: url, DATABASE_URL: url };
  const proofOut = execFileSync(proofBin, [proofScript, '--before-point8b1'], {
    cwd: repoRoot(),
    env: proofEnv,
    encoding: 'utf8',
  });
  console.log(proofOut);
  assert(proofOut.includes(POINT8B1_NAME), 'pending proof output missing Point 8B-1');
  assert(proofOut.includes(POINT8B6_NAME), 'pending proof output missing Point 8B-6');
  assert(proofOut.includes(POINT8C_NAME), 'pending proof output missing Point 8C');
  assert(proofOut.includes('[fr004-pending-proof] PASS'), 'before-point8b1 proof did not PASS');
  console.log('[point8b1] PASS --before-point8b1 positive current-gate');

  function expectGateFail(label: string, pattern: RegExp): void {
    let failed = false;
    let out = '';
    try {
      out = execFileSync(proofBin, [proofScript, '--before-point8b1'], {
        cwd: repoRoot(),
        env: proofEnv,
        encoding: 'utf8',
      });
    } catch (err) {
      failed = true;
      const e = err as { stdout?: string; stderr?: string; message?: string };
      out = `${e.stdout || ''}${e.stderr || ''}${e.message || ''}`;
    }
    assert(failed, `before-point8b1 must FAIL CLOSED for ${label}`);
    assert(pattern.test(out), `${label}: missing fail signal in: ${out.slice(0, 600)}`);
    console.log(`[point8b1] PASS --before-point8b1 negative ${label} FAIL CLOSED as expected`);
  }

  // Negative 1: unknown FINISHED migration row
  const unexpectedFinished = '20990101000000_unexpected_test_migration';
  psql(
    url,
    `INSERT INTO "_prisma_migrations"
      (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES
      ('00000000-0000-4000-8000-000000000999', '${'e'.repeat(64)}', now(), '${unexpectedFinished}', NULL, NULL, now(), 1);`
  );
  expectGateFail('finished-unknown', /row count mismatch|name set mismatch|unexpected/i);
  psql(url, `DELETE FROM "_prisma_migrations" WHERE "migration_name"='${unexpectedFinished}';`);

  // Negative 2: unknown UNFINISHED migration row (finished_at NULL) must not escape via applied Set
  const unexpectedUnfinished = '20990101000001_unexpected_unfinished_migration';
  psql(
    url,
    `INSERT INTO "_prisma_migrations"
      (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES
      ('00000000-0000-4000-8000-000000000998', '${'f'.repeat(64)}', NULL, '${unexpectedUnfinished}', NULL, NULL, now(), 0);`
  );
  expectGateFail('unfinished-unknown', /row count mismatch|name set mismatch|unexpected|unfinished/i);
  psql(url, `DELETE FROM "_prisma_migrations" WHERE "migration_name"='${unexpectedUnfinished}';`);

  // Negative 3: duplicate expected migration-name row
  psql(
    url,
    `INSERT INTO "_prisma_migrations"
      (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES
      ('00000000-0000-4000-8000-000000000997', '${'a'.repeat(64)}', now(), '${SLICE0_NAME}', NULL, NULL, now(), 1);`
  );
  expectGateFail('duplicate-expected-row', /Duplicate migration_name|row count mismatch/i);
  psql(
    url,
    `DELETE FROM "_prisma_migrations" WHERE "id"='00000000-0000-4000-8000-000000000997';`
  );

  const cleanupOut = execFileSync(proofBin, [proofScript, '--before-point8b1'], {
    cwd: repoRoot(),
    env: proofEnv,
    encoding: 'utf8',
  });
  assert(cleanupOut.includes('[fr004-pending-proof] PASS'), 'gate must PASS again on clean 8-row history');

  console.log('[point8b1] ALL_PASS');
}

try {
  main();
} catch (err) {
  console.error('[point8b1] FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
}
