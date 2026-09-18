# Point 7 — Slice 0 (Organization + Membership foundation)

## What this slice adds

- `Organization` and `Membership` Prisma models
- Additive SQL migration only
- Deterministic, idempotent legacy backfill tooling (dry-run by default)
- Atomic `--apply` (single Prisma transaction; all-or-nothing)
- Pure in-batch collision preflight before any writes

## What this slice does NOT do

- Does **not** add `organizationId` to CRM / campaigns / billing / automation / AI tables
- Does **not** change runtime API authorization (still `userId`)
- Does **not** implement TenantContext, org switching, SEC-07, SEC-08, or RLS
- Does **not** claim full multi-tenant isolation yet

## Migration baseline (FR-004)

Repository remediation establishes an active Prisma history of:

1. `20260918010000_baseline_production_pre_organization`
2. `20260918020000_add_organization_membership` (this Slice 0 migration)

Legacy ALTER-first migrations are frozen under `prisma/migrations-legacy-pre-baseline/`.

See:

- `docs/database/fr-004-migration-integrity-runbook.md`
- `docs/database/fr-004-baseline-review-checklist.md`

**EXTERNAL_PRODUCTION_PARITY_REVIEW = PASS**

The reviewed baseline artifact was independently validated against production metadata (structure only). That PASS does **not** authorize any production mutation.

Production remains gated as follows:

- **Production Authorization A** (`migrate resolve --applied` baseline only) remains **BLOCKED** pending:
  - merged repository PR
  - backup / PITR verification
  - fresh production preflight
  - explicit authorization
- **Production Authorization B** (`migrate deploy` Slice 0 only) remains separately **BLOCKED**
- **Backfill** remains separately **BLOCKED**

Do **not** treat FR-004 repository merge (or parity PASS) as permission to mutate production.

## Legacy mapping

```
User (current workspace root)
  -> Organization.id = legacy_org_<userId>
  -> Membership(role=OWNER, status=ACTIVE)
```

Ownership mapping comes only from the existing User tenant boundary.

## Backfill

```bash
# Dry run (default) — no writes
npm run tenancy:backfill-legacy-orgs

# Apply (only with explicit authorization; never against production without approval)
npm run tenancy:backfill-legacy-orgs -- --apply
```

Apply behavior:

1. Plan all users
2. Fail closed on planning conflicts or in-batch collisions (zero writes)
3. `--apply` runs all creates inside one Prisma transaction
4. Any write failure rolls back the entire batch (no partial committed state)
5. Unique constraints remain the final race defense (no `skipDuplicates`)

## New users during transition

Registration remains unchanged in Slice 0. Before organization-scoped APIs become mandatory, a later slice must ensure every User has a legacy Organization via the same deterministic mapping (registration hook and/or repeatable backfill).
