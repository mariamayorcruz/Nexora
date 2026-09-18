# Point 7 — Slice 0 (Organization + Membership foundation)

## What this slice adds

- `Organization` and `Membership` Prisma models
- Additive SQL migration only
- Deterministic, idempotent legacy backfill tooling (dry-run by default)

## What this slice does NOT do

- Does **not** add `organizationId` to CRM / campaigns / billing / automation / AI tables
- Does **not** change runtime API authorization (still `userId`)
- Does **not** implement TenantContext, org switching, SEC-07, SEC-08, or RLS
- Does **not** claim full multi-tenant isolation yet

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
npx tsx scripts/backfill-legacy-organizations.ts

# Apply (only with explicit authorization; never against production without approval)
npx tsx scripts/backfill-legacy-organizations.ts --apply
```

## New users during transition

Registration remains unchanged in Slice 0. Before organization-scoped APIs become mandatory, a later slice must ensure every User has a legacy Organization via the same deterministic mapping (registration hook and/or repeatable backfill).
