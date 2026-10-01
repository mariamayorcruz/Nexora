#!/usr/bin/env tsx
/**
 * FR-004 / Point 8B-1 custom pending-state proof (READ-ONLY against the target DB).
 *
 * Does NOT require `prisma migrate status` to succeed.
 * Compares local active migrations vs `_prisma_migrations` and derives pending.
 *
 * Modes:
 *   --before-point8b1
 *     CURRENT production gate (Point 7 foundation complete; Point 8B-1 not applied).
 *     Expected pending: exactly Point 8B-1.
 *
 *   --after-auth-a
 *     HISTORICAL simulation only (pre-Authorization B). Not the current Point 8B-1 gate.
 *     Expected pending: Slice 0 then Point 8B-1.
 *
 *   (default) informational — prints pending; does not enforce a gate.
 *
 * Usage:
 *   FR004_DATABASE_URL=postgresql://... npm run fr004:pending-proof -- --before-point8b1
 *   FR004_DATABASE_URL=postgresql://... npm run fr004:pending-proof -- --after-auth-a
 *   # hosted metadata (read-only URL out-of-band; never mutate):
 *   FR004_DATABASE_URL=... npm run fr004:pending-proof -- --before-point8b1 --allow-hosted-readonly
 *
 * When --allow-hosted-readonly is set, FR004_DATABASE_URL is required
 * (no fallback to DATABASE_URL). Prefer a least-privilege read-only credential.
 */

import {
  BASELINE_NAME,
  LEGACY_PRODUCTION_MIGRATION_NAMES,
  PENDING_AFTER_AUTH_A_HISTORICAL,
  PENDING_BEFORE_POINT8B1,
  POINT8B1_NAME,
  SLICE0_NAME,
  assertActiveMigrationSet,
  assertLegacyProductionMigrationRows,
  assertMigrationHistoryExactlyBeforePoint8B1,
  assertPendingExactly,
  assertSlice0Absent,
  assertSlice0Present,
  columnExists,
  derivePendingLocalActive,
  listActiveMigrationNames,
  prismaCliVersion,
  readMigrationRows,
  resolveFr004DatabaseUrl,
  sanitizeDbUrlForLog,
} from './fr004-lib'

type Mode = 'before-point8b1' | 'after-auth-a' | 'informational'

function resolveMode(): Mode {
  const beforePoint8b1 = process.argv.includes('--before-point8b1')
  const afterAuthA = process.argv.includes('--after-auth-a')
  if (beforePoint8b1 && afterAuthA) {
    throw new Error('Pass only one of --before-point8b1 or --after-auth-a')
  }
  if (beforePoint8b1) return 'before-point8b1'
  if (afterAuthA) return 'after-auth-a'
  return 'informational'
}

function main(): void {
  const mode = resolveMode()
  const allowHostedReadonly = process.argv.includes('--allow-hosted-readonly')

  assertActiveMigrationSet()
  const localActive = listActiveMigrationNames()
  const url = resolveFr004DatabaseUrl({ allowHostedReadonly })

  console.log(`[fr004-pending-proof] prisma=${prismaCliVersion()} mode=${mode}`)
  console.log(`[fr004-pending-proof] target=${sanitizeDbUrlForLog(url)}`)
  console.log(`[fr004-pending-proof] local_active=${localActive.join(',')}`)

  const rows = readMigrationRows(url)
  if (mode !== 'informational' || allowHostedReadonly) {
    assertLegacyProductionMigrationRows(rows)
  }

  const applied = new Set(
    rows.filter((r) => r.finished_at && !r.rolled_back_at).map((r) => r.migration_name),
  )

  for (const row of rows) {
    if (row.rolled_back_at) {
      throw new Error(`Rolled-back migration present: ${row.migration_name}`)
    }
    if (
      !row.finished_at &&
      (row.migration_name === BASELINE_NAME ||
        row.migration_name === SLICE0_NAME ||
        row.migration_name === POINT8B1_NAME)
    ) {
      throw new Error(`Unfinished relevant migration: ${row.migration_name}`)
    }
  }

  if (mode === 'before-point8b1') {
    // CURRENT gate: Point 7 foundation complete; Point 8B-1 not applied.
    // Raw history first (all rows): exact 8 names, each once, all finished, none rolled back.
    assertMigrationHistoryExactlyBeforePoint8B1(rows)

    assertSlice0Present(url)

    if (columnExists(url, 'CrmLead', 'organizationId')) {
      throw new Error('CrmLead.organizationId unexpectedly already present before Point 8B-1 apply')
    }

    const pending = derivePendingLocalActive(localActive, applied)
    console.log(`[fr004-pending-proof] pending=${pending.join(',') || '(none)'}`)
    assertPendingExactly(pending, PENDING_BEFORE_POINT8B1)
    console.log('[fr004-pending-proof] CURRENT gate --before-point8b1 OK (pending=Point8B1 only)')
  } else if (mode === 'after-auth-a') {
    // HISTORICAL only: pre-Authorization B (Slice 0 absent).
    console.log(
      '[fr004-pending-proof] HISTORICAL mode --after-auth-a (not the current Point 8B-1 production gate)',
    )
    for (const name of LEGACY_PRODUCTION_MIGRATION_NAMES) {
      if (!applied.has(name)) {
        throw new Error(`Missing expected legacy production migration row: ${name}`)
      }
    }
    if (!applied.has(BASELINE_NAME)) {
      throw new Error(`Baseline ${BASELINE_NAME} must be applied after Authorization A`)
    }
    if (applied.has(SLICE0_NAME)) {
      throw new Error(`Slice 0 unexpectedly already recorded in historical --after-auth-a mode`)
    }
    if (applied.has(POINT8B1_NAME)) {
      throw new Error(`Point 8B-1 unexpectedly already recorded in historical --after-auth-a mode`)
    }
    assertSlice0Absent(url)

    const pending = derivePendingLocalActive(localActive, applied)
    console.log(`[fr004-pending-proof] pending=${pending.join(',') || '(none)'}`)
    assertPendingExactly(pending, PENDING_AFTER_AUTH_A_HISTORICAL)
  } else {
    const pending = derivePendingLocalActive(localActive, applied)
    console.log(`[fr004-pending-proof] pending=${pending.join(',') || '(none)'}`)
    console.log(
      '[fr004-pending-proof] informational mode (use --before-point8b1 for current Point 8B-1 gate)',
    )
  }

  console.log('[fr004-pending-proof] PASS')
}

try {
  main()
} catch (err) {
  console.error('[fr004-pending-proof] FAIL', err instanceof Error ? err.message : err)
  process.exit(1)
}
