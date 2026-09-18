# Legacy Prisma migrations (pre-baseline freeze)

These directories are **frozen historical evidence** for FR-004.

They are **NOT** part of active Prisma Migrate replay.

Active history lives only under `prisma/migrations/` and currently contains:

1. `20260918010000_baseline_production_pre_organization`
2. `20260918020000_add_organization_membership`

## Do not reactivate blindly

Do **not** copy these folders back into `prisma/migrations/` without a new, explicitly authorized FR.

Reactivating the ALTER-first chain would break greenfield `prisma migrate deploy` and can collide with objects that already exist in production.

## Production history note

Production retains **six** historical `_prisma_migrations` rows for the early ALTER-era migrations. Those rows must remain untouched by FR-004 remediation. After squash/baselining they are intentional **database-only** history relative to the active local folder.

`prisma migrate status` may report that divergence. That is informational. Production gates use the custom FR-004 pending-state preflight, not a green `migrate status`.

## Tenant automation

`20260605120000_add_tenant_automation_config` is archived here because its table definition was **absorbed into the new baseline**.

Do **not**:

- leave it active under `prisma/migrations/`
- execute its `CREATE TABLE` against production
- rewrite it to `IF NOT EXISTS`
- mark it applied separately as the primary remediation

## Slice 0 archive copy

`20260918020000_add_organization_membership` is archived here as historical evidence only.

The **canonical active copy** remains:

`prisma/migrations/20260918020000_add_organization_membership/migration.sql`

Do not treat the archive copy as the deploy source of truth.
