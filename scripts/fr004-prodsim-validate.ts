#!/usr/bin/env tsx
/**
 * FR-004 Test B — HISTORICAL production-history simulation (disposable DB only).
 *
 * Simulates the completed Point 7 Auth A → Auth B path against today's active
 * migration chain (which also includes Point 8B-1).
 *
 * 1. Apply baseline SQL to create PRE-ORG schema (without recording Slice 0 / 8B-1)
 * 2. Simulate six historical `_prisma_migrations` rows
 * 3. `prisma migrate resolve --applied` baseline  (historical Auth A)
 * 4. Pending proof → exactly [Slice 0, Point 8B-1]  (historical post-Auth-A state)
 * 5. `prisma migrate deploy` → applies Slice 0 then Point 8B-1
 *
 * This is NOT the current Point 8B-1 production gate.
 * Current gate: `npm run fr004:pending-proof -- --before-point8b1`
 *
 * Never uses production URLs.
 */

import fs from 'node:fs'
import path from 'node:path'
import {
  BASELINE_NAME,
  LEGACY_PRODUCTION_MIGRATION_NAMES,
  PENDING_AFTER_AUTH_A_HISTORICAL,
  POINT8B1_NAME,
  SLICE0_NAME,
  assertActiveMigrationSet,
  assertDisposableDatabaseUrl,
  assertPendingExactly,
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
  assertPendingExactly(pending, PENDING_AFTER_AUTH_A_HISTORICAL)

  console.log('[fr004-prodsim] prisma migrate deploy (expects Slice 0 then Point 8B-1)')
  const deployOut = runPrisma(['migrate', 'deploy'], env)
  console.log(deployOut)

  if (!deployOut.includes(SLICE0_NAME)) {
    throw new Error('deploy output missing Slice 0')
  }
  if (!deployOut.includes(POINT8B1_NAME)) {
    throw new Error('deploy output missing Point 8B-1')
  }
  if (deployOut.includes(`Applying migration \`${BASELINE_NAME}\``)) {
    throw new Error('deploy unexpectedly applied baseline DDL')
  }
  // Historical Auth-A already resolved baseline; deploy must not re-apply it.
  const appliedMatch = deployOut.match(/The following migration\(s\) have been applied:([\s\S]*?)All migrations/i)
  if (appliedMatch && appliedMatch[1].includes(BASELINE_NAME)) {
    throw new Error('deploy applied baseline unexpectedly')
  }
  if (appliedMatch) {
    const block = appliedMatch[1]
    if (!block.includes(SLICE0_NAME) || !block.includes(POINT8B1_NAME)) {
      throw new Error('deploy applied set must include both Slice 0 and Point 8B-1')
    }
  }

  const finalRows = readMigrationRows(url)
  const finalNames = finalRows.map((r) => r.migration_name)
  for (const name of LEGACY_PRODUCTION_MIGRATION_NAMES) {
    if (!finalNames.includes(name)) throw new Error(`Legacy row missing after deploy: ${name}`)
  }
  if (
    !finalNames.includes(BASELINE_NAME) ||
    !finalNames.includes(SLICE0_NAME) ||
    !finalNames.includes(POINT8B1_NAME)
  ) {
    throw new Error(`Final migration set incomplete: ${finalNames.join(',')}`)
  }
  // six legacy + baseline + Slice 0 + Point 8B-1
  if (finalNames.length !== 9) {
    throw new Error(`Expected 9 migration rows after deploy; got ${finalNames.length}`)
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
