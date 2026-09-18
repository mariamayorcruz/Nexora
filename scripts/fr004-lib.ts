/**
 * Shared FR-004 helpers (repository-only / disposable DB tooling).
 * Never embeds credentials or production URLs.
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const BASELINE_NAME = '20260918010000_baseline_production_pre_organization'
export const SLICE0_NAME = '20260918020000_add_organization_membership'

export const LEGACY_PRODUCTION_MIGRATION_NAMES = [
  '20260215120000_lead_capture_paid_flags',
  '20260415120000_lead_capture_tracker_id',
  '20260416120000_conversion_automation_flags',
  '20260416140000_sales_recovery_followup_sent',
  '20260416160000_add_invoice_urls',
  '20260418193000_add_user_onboarding_fields',
] as const

export const FORBIDDEN_ACTIVE_MIGRATIONS = [
  ...LEGACY_PRODUCTION_MIGRATION_NAMES,
  '20260605120000_add_tenant_automation_config',
] as const

export const EXPECTED_PRE_ORG_TABLES = [
  'User',
  'Subscription',
  'AdAccount',
  'Campaign',
  'Analytics',
  'Invoice',
  'CrmLead',
  'CrmWorkspaceSettings',
  'tenant_automation_configs',
  'AiWorkspaceUsage',
  'AiWorkspaceJob',
  'AiVideoProject',
  'AiVideoProjectVersion',
  'AiVideoAsset',
  'LeadCapture',
  'VerificationToken',
  'PaymentSettings',
  'ConnectionRequest',
  'AdminWorkspaceConfig',
  'AttributionSession',
  'AttributionEvent',
] as const

export const SLICE0_TABLES = ['Organization', 'Membership'] as const
export const SLICE0_ENUMS = [
  'OrganizationStatus',
  'MembershipRole',
  'MembershipStatus',
] as const

export function repoRoot(): string {
  return path.resolve(__dirname, '..')
}

export function migrationsDir(): string {
  return path.join(repoRoot(), 'prisma', 'migrations')
}

export function listActiveMigrationNames(): string[] {
  const dir = migrationsDir()
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
}

export function assertActiveMigrationSet(): void {
  const names = listActiveMigrationNames()
  const expected = [BASELINE_NAME, SLICE0_NAME]
  if (names.length !== expected.length || expected.some((n, i) => names[i] !== n)) {
    throw new Error(
      `Active prisma/migrations must be exactly [${expected.join(', ')}]; found [${names.join(', ')}]`,
    )
  }
  for (const forbidden of FORBIDDEN_ACTIVE_MIGRATIONS) {
    if (names.includes(forbidden)) {
      throw new Error(`Forbidden active migration present: ${forbidden}`)
    }
  }
}

export type DbUrlPolicy = {
  /** When false (default), only local/disposable hosts are allowed. */
  allowHostedReadonly?: boolean
}

function parseDbUrl(url: string, label: string): URL {
  if (!url || !url.trim()) {
    throw new Error(`${label} is required`)
  }
  try {
    return new URL(url.replace(/^postgresql:/i, 'http:').replace(/^postgres:/i, 'http:'))
  } catch {
    throw new Error(`${label} is not a parseable PostgreSQL URL`)
  }
}

/**
 * Refuse obvious production / hosted targets for disposable FR-004 tests.
 * With allowHostedReadonly=true, hosted hosts are permitted for SELECT-only preflight scripts.
 */
export function assertDatabaseUrlPolicy(
  url: string,
  policy: DbUrlPolicy = {},
  label = 'DATABASE_URL',
): void {
  const parsed = parseDbUrl(url, label)
  const host = (parsed.hostname || '').toLowerCase()

  if (policy.allowHostedReadonly) {
    return
  }

  const full = url.toLowerCase()
  const blockedHostFragments = [
    'supabase.co',
    'pooler.supabase',
    'neon.tech',
    'railway.app',
    'rlwy.net',
    'amazonaws.com',
    'azure.com',
    'gcp.postgres',
    'vercel-storage',
    'elephantsql.com',
    'render.com',
    'digitalocean.com',
  ]
  if (blockedHostFragments.some((f) => host.includes(f) || full.includes(f))) {
    throw new Error(`${label} looks like a hosted/production database host; refusing`)
  }

  if (host.includes('prod') || host.startsWith('db.')) {
    throw new Error(`${label} host looks production-like; refusing`)
  }

  const allowLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === 'postgres' ||
    host.endsWith('.local')

  if (!allowLocal) {
    throw new Error(
      `${label} host "${host}" is not an allowed disposable/local target for FR-004 scripts`,
    )
  }
}

export function assertDisposableDatabaseUrl(url: string, label = 'DATABASE_URL'): void {
  assertDatabaseUrlPolicy(url, { allowHostedReadonly: false }, label)
}

export function sanitizeDbUrlForLog(url: string): string {
  try {
    const u = new URL(url.replace(/^postgresql:/i, 'http:').replace(/^postgres:/i, 'http:'))
    return `postgresql://${u.hostname}:${u.port || '5432'}${u.pathname}`
  } catch {
    return '[unparseable-url]'
  }
}

export function prismaCliVersion(): string {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot(), 'node_modules', 'prisma', 'package.json'), 'utf8'),
  ) as { version: string }
  return pkg.version
}

export function runPrisma(args: string[], env: NodeJS.ProcessEnv): string {
  const bin = path.join(repoRoot(), 'node_modules', '.bin', 'prisma')
  try {
    return execFileSync(bin, args, {
      cwd: repoRoot(),
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    const out = `${e.stdout || ''}${e.stderr || e.message || err}`
    throw new Error(`prisma ${args.join(' ')} failed:\n${out}`)
  }
}

/** Run SQL via psql URI (no secrets printed). Caller must enforce URL policy. */
export function psql(databaseUrl: string, sql: string): string {
  return execFileSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

export function psqlFile(databaseUrl: string, filePath: string): void {
  assertDisposableDatabaseUrl(databaseUrl)
  execFileSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', filePath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

export type MigrationRow = {
  migration_name: string
  finished_at: string | null
  rolled_back_at: string | null
  applied_steps_count: number
  logs_null: boolean
}

export function readMigrationRows(databaseUrl: string): MigrationRow[] {
  const raw = psql(
    databaseUrl,
    `SELECT migration_name || '|' ||
            COALESCE(finished_at::text, '') || '|' ||
            COALESCE(rolled_back_at::text, '') || '|' ||
            applied_steps_count::text || '|' ||
            CASE WHEN logs IS NULL THEN '1' ELSE '0' END
     FROM _prisma_migrations
     ORDER BY started_at, migration_name;`,
  )
  if (!raw) return []
  return raw.split('\n').filter(Boolean).map((line) => {
    const [migration_name, finished_at, rolled_back_at, applied_steps_count, logs_null] =
      line.split('|')
    return {
      migration_name,
      finished_at: finished_at || null,
      rolled_back_at: rolled_back_at || null,
      applied_steps_count: Number(applied_steps_count),
      logs_null: logs_null === '1',
    }
  })
}

export function tableExists(databaseUrl: string, table: string): boolean {
  const safe = table.replace(/"/g, '')
  const r = psql(
    databaseUrl,
    `SELECT CASE WHEN to_regclass('public."${safe}"') IS NULL THEN '0' ELSE '1' END;`,
  )
  return r === '1'
}

export function enumExists(databaseUrl: string, enumName: string): boolean {
  const r = psql(
    databaseUrl,
    `SELECT CASE WHEN EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = '${enumName.replace(/'/g, "''")}'
      ) THEN '1' ELSE '0' END;`,
  )
  return r === '1'
}

export function derivePendingLocalActive(
  localActive: string[],
  appliedNames: Set<string>,
): string[] {
  return localActive.filter((name) => !appliedNames.has(name))
}

export function assertPendingIsSlice0Only(pending: string[]): void {
  if (pending.length !== 1 || pending[0] !== SLICE0_NAME) {
    throw new Error(
      `Expected pending local-active migrations to be exactly [${SLICE0_NAME}]; got [${pending.join(', ')}]`,
    )
  }
}

export function assertPreOrgTablesPresent(databaseUrl: string): void {
  for (const table of EXPECTED_PRE_ORG_TABLES) {
    if (!tableExists(databaseUrl, table)) {
      throw new Error(`Expected pre-org table missing: ${table}`)
    }
  }
}

export function assertSlice0Absent(databaseUrl: string): void {
  for (const table of SLICE0_TABLES) {
    if (tableExists(databaseUrl, table)) {
      throw new Error(`Slice 0 table unexpectedly present: ${table}`)
    }
  }
  for (const e of SLICE0_ENUMS) {
    if (enumExists(databaseUrl, e)) {
      throw new Error(`Slice 0 enum unexpectedly present: ${e}`)
    }
  }
}

export function assertSlice0Present(databaseUrl: string): void {
  for (const table of SLICE0_TABLES) {
    if (!tableExists(databaseUrl, table)) {
      throw new Error(`Slice 0 table missing: ${table}`)
    }
  }
  for (const e of SLICE0_ENUMS) {
    if (!enumExists(databaseUrl, e)) {
      throw new Error(`Slice 0 enum missing: ${e}`)
    }
  }
}
