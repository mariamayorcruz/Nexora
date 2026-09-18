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

## Migration baseline (FR-004) — BLOCKED for production deploy

The repository’s historical Prisma migration chain does **not** contain a complete initial schema baseline (early migrations `ALTER` existing tables rather than creating the original core schema). This is the pre-existing **FR-004** migration-integrity issue.

PR #7 may introduce the additive Slice 0 migration file, but **production migration execution remains BLOCKED** until FR-004 migration baseline integrity is separately resolved or an explicitly reviewed production migration procedure is approved.

Do **not** treat this PR as ready for standard `prisma migrate deploy` in production.

This PR does **not**:

- create a fake initial migration
- rewrite old migrations
- mark migrations applied
- run migrate resolve
- reset any database
- run db push
- inspect/execute production migration state

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
