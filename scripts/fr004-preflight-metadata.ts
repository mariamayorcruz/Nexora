#!/usr/bin/env tsx
/**
 * FR-004 read-only metadata preflight (structure + migration inventory).
 *
 * Default: disposable/local URLs only.
 * Optional: --allow-hosted-readonly for a future least-privilege production
 * metadata inspection (still SELECT-only; no DDL/DML).
 *
 * Never prints connection secrets.
 */

import {
  BASELINE_NAME,
  EXPECTED_PRE_ORG_TABLES,
  LEGACY_PRODUCTION_MIGRATION_NAMES,
  SLICE0_NAME,
  assertActiveMigrationSet,
  assertDatabaseUrlPolicy,
  assertSlice0Absent,
  enumExists,
  listActiveMigrationNames,
  prismaCliVersion,
  psql,
  readMigrationRows,
  sanitizeDbUrlForLog,
  tableExists,
} from './fr004-lib'

function main(): void {
  const allowHosted = process.argv.includes('--allow-hosted-readonly')
  const expectBaselineApplied = process.argv.includes('--expect-baseline-applied')
  const url = process.env.FR004_DATABASE_URL || process.env.DATABASE_URL
  if (!url) throw new Error('Set FR004_DATABASE_URL or DATABASE_URL')
  assertDatabaseUrlPolicy(url, { allowHostedReadonly: allowHosted })

  assertActiveMigrationSet()
  console.log(`[fr004-preflight] prisma=${prismaCliVersion()}`)
  console.log(`[fr004-preflight] target=${sanitizeDbUrlForLog(url)}`)
  console.log(`[fr004-preflight] local_active=${listActiveMigrationNames().join(',')}`)

  // Application schema inventory (metadata only)
  const missingTables: string[] = []
  for (const table of EXPECTED_PRE_ORG_TABLES) {
    if (!tableExists(url, table)) missingTables.push(table)
  }
  if (missingTables.length) {
    throw new Error(`Missing expected application tables: ${missingTables.join(', ')}`)
  }
  console.log(`[fr004-preflight] pre_org_tables=OK count=${EXPECTED_PRE_ORG_TABLES.length}`)

  assertSlice0Absent(url)
  console.log('[fr004-preflight] slice0_objects=ABSENT (expected before Auth B)')

  const rows = readMigrationRows(url)
  const names = rows.map((r) => r.migration_name)
  console.log(`[fr004-preflight] prisma_migrations_count=${rows.length}`)
  console.log(`[fr004-preflight] prisma_migrations_names=${names.join(',')}`)

  for (const name of LEGACY_PRODUCTION_MIGRATION_NAMES) {
    if (!names.includes(name)) {
      console.log(`[fr004-preflight] WARN legacy_row_missing_in_this_db=${name}`)
    }
  }

  if (expectBaselineApplied) {
    if (!names.includes(BASELINE_NAME)) {
      throw new Error(`Expected baseline row ${BASELINE_NAME}`)
    }
    if (names.includes(SLICE0_NAME)) {
      throw new Error(`Slice 0 must not be recorded yet`)
    }
  }

  // Sanity: public schema only probe (no row data)
  const schema = psql(url, `SELECT current_schema();`)
  console.log(`[fr004-preflight] current_schema=${schema}`)

  // Ensure Slice 0 enums absent
  for (const e of ['OrganizationStatus', 'MembershipRole', 'MembershipStatus']) {
    if (enumExists(url, e)) throw new Error(`Unexpected enum present: ${e}`)
  }

  console.log('[fr004-preflight] PASS (read-only)')
  console.log('[fr004-preflight] NOTE: BASELINE_REQUIRES_EXTERNAL_PRODUCTION_PARITY_REVIEW')
}

try {
  main()
} catch (err) {
  console.error('[fr004-preflight] FAIL', err instanceof Error ? err.message : err)
  process.exit(1)
}
