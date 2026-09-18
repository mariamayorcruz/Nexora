#!/usr/bin/env tsx
/**
 * FR-004 custom pending-state proof (READ-ONLY against the target DB).
 *
 * Does NOT require `prisma migrate status` to succeed.
 * Compares local active migrations vs `_prisma_migrations` and derives pending.
 *
 * Usage:
 *   FR004_DATABASE_URL=postgresql://... npm run fr004:pending-proof -- --after-auth-a
 *   # future production metadata (read-only URL provided out-of-band):
 *   FR004_DATABASE_URL=... npm run fr004:pending-proof -- --after-auth-a --allow-hosted-readonly
 */

import {
  BASELINE_NAME,
  LEGACY_PRODUCTION_MIGRATION_NAMES,
  SLICE0_NAME,
  assertActiveMigrationSet,
  assertDatabaseUrlPolicy,
  assertPendingIsSlice0Only,
  assertSlice0Absent,
  derivePendingLocalActive,
  listActiveMigrationNames,
  prismaCliVersion,
  readMigrationRows,
  sanitizeDbUrlForLog,
} from './fr004-lib'

function resolveUrl(): string {
  const url = process.env.FR004_DATABASE_URL || process.env.DATABASE_URL
  if (!url) {
    throw new Error('Set FR004_DATABASE_URL (preferred) or DATABASE_URL')
  }
  return url
}

function main(): void {
  const mode = process.argv.includes('--after-auth-a') ? 'after-auth-a' : 'informational'
  const allowHostedReadonly = process.argv.includes('--allow-hosted-readonly')

  assertActiveMigrationSet()
  const localActive = listActiveMigrationNames()
  const url = resolveUrl()
  assertDatabaseUrlPolicy(url, { allowHostedReadonly })

  console.log(`[fr004-pending-proof] prisma=${prismaCliVersion()} mode=${mode}`)
  console.log(`[fr004-pending-proof] target=${sanitizeDbUrlForLog(url)}`)
  console.log(`[fr004-pending-proof] local_active=${localActive.join(',')}`)

  const rows = readMigrationRows(url)
  const applied = new Set(
    rows.filter((r) => r.finished_at && !r.rolled_back_at).map((r) => r.migration_name),
  )

  for (const row of rows) {
    if (row.rolled_back_at) {
      throw new Error(`Rolled-back migration present: ${row.migration_name}`)
    }
    if (
      !row.finished_at &&
      (row.migration_name === BASELINE_NAME || row.migration_name === SLICE0_NAME)
    ) {
      throw new Error(`Unfinished relevant migration: ${row.migration_name}`)
    }
  }

  if (mode === 'after-auth-a') {
    for (const name of LEGACY_PRODUCTION_MIGRATION_NAMES) {
      if (!applied.has(name)) {
        throw new Error(`Missing expected legacy production migration row: ${name}`)
      }
    }
    if (!applied.has(BASELINE_NAME)) {
      throw new Error(`Baseline ${BASELINE_NAME} must be applied after Authorization A`)
    }
    if (applied.has(SLICE0_NAME)) {
      throw new Error(`Slice 0 unexpectedly already recorded before Authorization B`)
    }
    assertSlice0Absent(url)

    const pending = derivePendingLocalActive(localActive, applied)
    console.log(`[fr004-pending-proof] pending=${pending.join(',') || '(none)'}`)
    assertPendingIsSlice0Only(pending)
  } else {
    const pending = derivePendingLocalActive(localActive, applied)
    console.log(`[fr004-pending-proof] pending=${pending.join(',') || '(none)'}`)
    console.log('[fr004-pending-proof] informational mode (pass --after-auth-a for Auth B gate)')
  }

  console.log('[fr004-pending-proof] PASS')
}

try {
  main()
} catch (err) {
  console.error('[fr004-pending-proof] FAIL', err instanceof Error ? err.message : err)
  process.exit(1)
}
