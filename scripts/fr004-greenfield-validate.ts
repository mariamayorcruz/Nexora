#!/usr/bin/env tsx
/**
 * FR-004 Test A — Greenfield validation.
 *
 * EMPTY disposable PostgreSQL
 *   → prisma migrate deploy
 *   → baseline + Slice 0 apply
 *   → structural checks vs expected tables/enums
 *
 * Requires:
 *   FR004_DATABASE_URL or DATABASE_URL pointing at an EMPTY local/disposable DB
 *   psql available
 *
 * Refuses hosted/production-looking URLs.
 */

import {
  BASELINE_NAME,
  EXPECTED_PRE_ORG_TABLES,
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
} from './fr004-lib'

function main(): void {
  const url = process.env.FR004_DATABASE_URL || process.env.DATABASE_URL
  if (!url) throw new Error('Set FR004_DATABASE_URL or DATABASE_URL to an EMPTY disposable Postgres')
  assertDisposableDatabaseUrl(url)
  assertActiveMigrationSet()

  const version = prismaCliVersion()
  console.log(`[fr004-greenfield] prisma=${version}`)
  console.log(`[fr004-greenfield] target=${sanitizeDbUrlForLog(url)}`)

  // Fail closed if DB already has application tables
  const existing = psql(
    url,
    `SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE'
       AND table_name <> '_prisma_migrations';`,
  )
  if (existing !== '0') {
    throw new Error(
      `Database is not empty (public base tables excluding _prisma_migrations count=${existing}). Use a fresh disposable DB.`,
    )
  }

  const env = { ...process.env, DATABASE_URL: url }
  console.log('[fr004-greenfield] running prisma validate')
  runPrisma(['validate'], env)
  console.log('[fr004-greenfield] running prisma generate')
  runPrisma(['generate'], env)

  console.log('[fr004-greenfield] running prisma migrate deploy')
  const deployOut = runPrisma(['migrate', 'deploy'], env)
  console.log(deployOut)

  if (!deployOut.includes(BASELINE_NAME) || !deployOut.includes(SLICE0_NAME)) {
    throw new Error('migrate deploy output did not mention both baseline and Slice 0')
  }

  const rows = readMigrationRows(url)
  const names = rows.map((r) => r.migration_name)
  if (names.length !== 2 || names[0] !== BASELINE_NAME || names[1] !== SLICE0_NAME) {
    throw new Error(`Unexpected _prisma_migrations after greenfield: ${names.join(',')}`)
  }

  assertPreOrgTablesPresent(url)
  assertSlice0Present(url)

  // Spot-check tenant_automation FK existence (metadata)
  const fk = psql(
    url,
    `SELECT COUNT(*) FROM information_schema.table_constraints
     WHERE table_schema='public'
       AND table_name='tenant_automation_configs'
       AND constraint_type='FOREIGN KEY';`,
  )
  if (fk === '0') throw new Error('tenant_automation_configs missing FK')

  console.log(`[fr004-greenfield] pre_org_tables=${EXPECTED_PRE_ORG_TABLES.length} OK`)
  console.log('[fr004-greenfield] slice0_objects=OK')
  console.log('[fr004-greenfield] PASS')
}

try {
  main()
} catch (err) {
  console.error('[fr004-greenfield] FAIL', err instanceof Error ? err.message : err)
  process.exit(1)
}
