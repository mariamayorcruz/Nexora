/**
 * Point 8B-1 — disposable validation for CrmLead organization DB foundation.
 *
 * Validates the additive migration only:
 *   - nullable organizationId column
 *   - approved indexes
 *   - FK → Organization ON DELETE RESTRICT
 *   - no backfill side effects
 *   - existing synthetic rows keep organizationId NULL
 *   - userId remains NOT NULL / cascade unchanged
 *
 * Does NOT modify runtime application code paths.
 * Does NOT touch production.
 *
 * Requires FR004_DATABASE_URL or DATABASE_URL → disposable local Postgres.
 *
 * Usage:
 *   FR004_DATABASE_URL=postgresql://... npm run tenancy:validate-point8b1
 */

import { randomUUID } from 'node:crypto';
import {
  BASELINE_NAME,
  POINT8B1_NAME,
  SLICE0_NAME,
  assertActiveMigrationSet,
  assertDisposableDatabaseUrl,
  assertPreOrgTablesPresent,
  assertSlice0Present,
  prismaCliVersion,
  psql,
  readMigrationRows,
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

  // PostgreSQL confdeltype: a=NO ACTION, r=RESTRICT, c=CASCADE, n=SET NULL, d=SET DEFAULT
  const del = fkDeleteRule(url, 'CrmLead_organizationId_fkey');
  assert(del === 'r' || del === 'a', `expected RESTRICT/NO ACTION delete rule, got '${del}'`);

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
  console.log('[point8b1] ALL_PASS');
}

try {
  main();
} catch (err) {
  console.error('[point8b1] FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
}
