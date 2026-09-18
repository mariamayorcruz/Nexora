#!/usr/bin/env tsx
/**
 * FR-004 Test B — Production-history simulation (disposable DB only).
 *
 * 1. Apply baseline SQL to create PRE-ORG schema (without recording Slice 0)
 * 2. Simulate six historical `_prisma_migrations` rows
 * 3. `prisma migrate resolve --applied` baseline
 * 4. Custom pending-state proof → Slice 0 only
 * 5. `prisma migrate deploy` → ONLY Slice 0
 *
 * Never uses production URLs.
 */

import fs from 'node:fs'
import path from 'node:path'
import {
  BASELINE_NAME,
  LEGACY_PRODUCTION_MIGRATION_NAMES,
  SLICE0_NAME,
  assertActiveMigrationSet,
  assertDisposableDatabaseUrl,
  assertPendingIsSlice0Only,
  assertPreOrgTablesPresent,
  assertSlice0Absent,
  assertSlice0Present,
  derivePendingLocalActive,
  listActiveMigrationNames,
  prismaCliVersion,
  psql,
  psqlFile,
  readMigrationRows,
  repoRoot,
  runPrisma,
  sanitizeDbUrlForLog,
} from './fr004-lib'

function resetPublicSchema(url: string): void {
  psql(url, 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
}

function seedLegacyMigrationRows(url: string): void {
  // Create Prisma migrations table shape compatible with Migrate
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
    );`,
  )

  LEGACY_PRODUCTION_MIGRATION_NAMES.forEach((name, idx) => {
    const id = `00000000-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`
    const checksum = 'a'.repeat(64)
    psql(
      url,
      `INSERT INTO "_prisma_migrations"
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES
        ('${id}', '${checksum}', now(), '${name}', NULL, NULL, now() - interval '${10 - idx} days', 1);`,
    )
  })
}

function main(): void {
  const url = process.env.FR004_DATABASE_URL || process.env.DATABASE_URL
  if (!url) throw new Error('Set FR004_DATABASE_URL or DATABASE_URL to a disposable Postgres')
  assertDisposableDatabaseUrl(url)
  assertActiveMigrationSet()

  const version = prismaCliVersion()
  console.log(`[fr004-prodsim] prisma=${version}`)
  console.log(`[fr004-prodsim] target=${sanitizeDbUrlForLog(url)}`)

  resetPublicSchema(url)

  const baselineSql = path.join(
    repoRoot(),
    'prisma',
    'migrations',
    BASELINE_NAME,
    'migration.sql',
  )
  if (!fs.existsSync(baselineSql)) throw new Error(`Missing baseline SQL at ${baselineSql}`)

  console.log('[fr004-prodsim] applying baseline SQL to simulate PRE-ORG production schema')
  psqlFile(url, baselineSql)
  assertPreOrgTablesPresent(url)
  assertSlice0Absent(url)

  console.log('[fr004-prodsim] seeding six simulated legacy _prisma_migrations rows')
  seedLegacyMigrationRows(url)

  const beforeResolve = readMigrationRows(url).map((r) => r.migration_name)
  if (beforeResolve.length !== 6) {
    throw new Error(`Expected 6 legacy rows before resolve; got ${beforeResolve.length}`)
  }

  const env = { ...process.env, DATABASE_URL: url }

  console.log(`[fr004-prodsim] prisma migrate resolve --applied ${BASELINE_NAME}`)
  const resolveOut = runPrisma(['migrate', 'resolve', '--applied', BASELINE_NAME], env)
  console.log(resolveOut)

  const afterResolve = readMigrationRows(url)
  const afterNames = afterResolve.map((r) => r.migration_name)
  for (const name of LEGACY_PRODUCTION_MIGRATION_NAMES) {
    if (!afterNames.includes(name)) throw new Error(`Legacy row missing after resolve: ${name}`)
  }
  if (!afterNames.includes(BASELINE_NAME)) throw new Error('Baseline row not added by resolve')
  if (afterNames.includes(SLICE0_NAME)) throw new Error('Slice 0 unexpectedly present after resolve')
  if (afterNames.length !== 7) {
    throw new Error(`Expected 7 migration rows after resolve; got ${afterNames.length}`)
  }
  assertSlice0Absent(url)
  console.log('[fr004-prodsim] resolve verification OK (six legacy preserved + baseline added)')

  const localActive = listActiveMigrationNames()
  const applied = new Set(
    afterResolve.filter((r) => r.finished_at && !r.rolled_back_at).map((r) => r.migration_name),
  )
  const pending = derivePendingLocalActive(localActive, applied)
  console.log(`[fr004-prodsim] pending_proof=${pending.join(',')}`)
  assertPendingIsSlice0Only(pending)

  console.log('[fr004-prodsim] prisma migrate deploy')
  const deployOut = runPrisma(['migrate', 'deploy'], env)
  console.log(deployOut)

  if (!deployOut.includes(SLICE0_NAME)) {
    throw new Error('deploy output missing Slice 0')
  }
  if (deployOut.includes(`Applying migration \`${BASELINE_NAME}\``)) {
    throw new Error('deploy unexpectedly applied baseline DDL')
  }
  // Ensure only one migration applied in this deploy
  const appliedMatch = deployOut.match(/The following migration\(s\) have been applied:([\s\S]*?)All migrations/i)
  if (appliedMatch && appliedMatch[1].includes(BASELINE_NAME)) {
    throw new Error('deploy applied baseline unexpectedly')
  }

  const finalRows = readMigrationRows(url)
  const finalNames = finalRows.map((r) => r.migration_name)
  for (const name of LEGACY_PRODUCTION_MIGRATION_NAMES) {
    if (!finalNames.includes(name)) throw new Error(`Legacy row missing after deploy: ${name}`)
  }
  if (!finalNames.includes(BASELINE_NAME) || !finalNames.includes(SLICE0_NAME)) {
    throw new Error(`Final migration set incomplete: ${finalNames.join(',')}`)
  }
  if (finalNames.length !== 8) {
    throw new Error(`Expected 8 migration rows after deploy; got ${finalNames.length}`)
  }

  assertSlice0Present(url)
  console.log('[fr004-prodsim] Organization/Membership/enums present')
  console.log('[fr004-prodsim] PASS')
}

try {
  main()
} catch (err) {
  console.error('[fr004-prodsim] FAIL', err instanceof Error ? err.message : err)
  process.exit(1)
}
