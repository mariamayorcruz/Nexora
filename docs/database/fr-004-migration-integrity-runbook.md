# FR-004 — Migration integrity runbook

Repository-only remediation established a trusted Prisma baseline and Point 7
Slice 0 foundation. **Later production mutations (including Point 8B-1) require
their own explicit authorization.**

## External baseline parity

**EXTERNAL_PRODUCTION_PARITY_REVIEW = PASS** for reviewed artifact/head:

`f272004413bc165da740d11c3e67f31a03da6a08`

Details: `docs/database/fr-004-baseline-review-checklist.md`.

Parity PASS did **not** by itself authorize production mutation; Auth A/B were
completed under separate explicit authorizations (see Historical section).

## Concepts

| History | Role |
|---------|------|
| `prisma/migrations/` | Active Prisma replay: baseline + Slice 0 + Point 8B-1 |
| `prisma/migrations-legacy-pre-baseline/` | Frozen historical SQL evidence (not replayed) |
| `supabase/migrations/` | Supabase RLS / security history (separate from Prisma) |

- **Prisma migration history** = application schema
- **Supabase migration history** = RLS / security-specific history

Runtime tooling prints `baseline_parity_status=SEE_REVIEW_CHECKLIST` and does not certify parity itself.

## Active migrations

1. `20260918010000_baseline_production_pre_organization`
2. `20260918020000_add_organization_membership`
3. `20260930011200_add_crmlead_organization_tenancy_foundation` (Point 8B-1 — additive nullable `CrmLead.organizationId`; no backfill; production apply separately authorized)

## Current expected production state (before Point 8B-1 apply)

Point 7 foundation is **COMPLETE** (not blocked):

- six historical legacy `_prisma_migrations` rows remain
- trusted baseline recorded/applied
- Slice 0 recorded/applied
- Organization / Membership / related enums exist
- legacy Organization backfill completed
- Point 7 Slice 1A merged/deployed
- **Point 8B-1 is NOT yet applied**
- **`CrmLead.organizationId` does NOT yet exist**

Do **not** use `prisma migrate status` alone as the production gate (legacy rows
still diverge from the local active folder). Use the custom pending proof below.

---

## POINT 8B-1 PRODUCTION MIGRATION GATE

**Status: BLOCKED** pending separate explicit authorization.

This is the **current** next production Prisma DDL operation.

### Preconditions

1. Point 8B-1 PR reviewed (and merged when that step is authorized)
2. Backup / PITR posture confirmed as required by operators
3. Read-only current-state preflight PASS:

```bash
FR004_DATABASE_URL=... npm run fr004:pending-proof -- --before-point8b1 --allow-hosted-readonly
```

When `--allow-hosted-readonly` is set, **`FR004_DATABASE_URL` is required**
(no fallback to `DATABASE_URL`). Prefer a least-privilege **read-only**
credential. Do not embed credentials in docs or scripts.

4. Derived pending local-active migrations are **EXACTLY**:

`20260930011200_add_crmlead_organization_tenancy_foundation`

5. Explicit production migration authorization for Point 8B-1 only

### Expected future apply (only when authorized)

```bash
prisma migrate deploy
```

**Expected:** ONLY

`20260930011200_add_crmlead_organization_tenancy_foundation`

### Expected post-apply DB

- `CrmLead.organizationId` exists and is **nullable**
- indexes exist:
  - `CrmLead_organizationId_updatedAt_idx`
  - `CrmLead_organizationId_stage_idx`
  - `CrmLead_userId_idx`
- FK `CrmLead_organizationId_fkey` → `Organization` with **ON DELETE RESTRICT**
- existing `CrmLead` rows remain `organizationId = NULL` (no backfill)
- active runtime Prisma schema alignment still deferred until **8B-2**
- no dual-write / read cutover / multi-org writes yet

### Not authorized by this runbook section

- production migration apply (until explicit authorization)
- backfill
- runtime dual-write
- organizationId read cutover
- multi-org CRM writes
- active `prisma/schema.prisma` alignment before physical DB verification
- `db push` / `migrate reset` / `migrate dev` against production

---

## Historical — Production Authorization A (COMPLETED)

**Status: COMPLETED / HISTORICAL** — do not treat as the current next operation.

Historical allowed command (already executed under prior authorization):

```bash
prisma migrate resolve --applied 20260918010000_baseline_production_pre_organization
```

Historical verification intent:

1. Six legacy rows remain unchanged
2. Baseline row added and finished
3. Application schema unchanged at that moment (no Organization / Membership yet)
4. Pending local-active at that historical moment (with today's chain) would be
   Slice 0 **then** Point 8B-1 — use historical mode only for simulations:

```bash
# HISTORICAL simulation gate only — NOT current Point 8B-1 production procedure
FR004_DATABASE_URL=... npm run fr004:pending-proof -- --after-auth-a
```

---

## Historical — Production Authorization B (COMPLETED)

**Status: COMPLETED / HISTORICAL** — Slice 0 DDL already applied in production.

Historical expected apply:

- `20260918020000_add_organization_membership`

Historical verification intent:

1. Slice 0 row finished
2. Six legacy + baseline rows still present
3. Organization / Membership / enums exist
4. Runtime tenancy still userId-authoritative for business tables at that time

**Note:** With Point 8B-1 now present in the active local chain, a fresh
historical Auth-A simulation (`fr004:prodsim`) will show pending
`[Slice0, Point8B1]` and a subsequent `migrate deploy` applies **both**.
That is correct for disposable historical simulation against today's folder,
and is **not** the current production Point 8B-1 gate (use `--before-point8b1`).

---

## Historical — legacy Organization backfill (COMPLETED)

Dry-run / `--apply` of legacy organization backfill was a separate Point 7
authorization after Auth B. See `docs/point-7-slice-0.md`.

Point 8B-1 does **not** backfill `CrmLead.organizationId` (that is Point 8B-3,
separately authorized later).

---

## Local / CI validation (repository / disposable only)

```bash
# Empty disposable DB — applies baseline + Slice 0 + Point 8B-1
FR004_DATABASE_URL=postgresql://... npm run fr004:greenfield

# Disposable HISTORICAL prod-history simulation (Auth A → deploy Slice0+8B1)
FR004_DATABASE_URL=postgresql://... npm run fr004:prodsim

# Point 8B-1 migration semantics + CURRENT --before-point8b1 gate on synthetic DB
FR004_DATABASE_URL=postgresql://... npm run tenancy:validate-point8b1
```

Scripts refuse obvious hosted/production URLs unless `--allow-hosted-readonly`
is explicitly used with `FR004_DATABASE_URL`.

## Stop conditions

Stop closed if unexpected pending migrations, missing/unfinished/rolled-back
legacy history rows, backup unavailable, Point 8B-1 already partially applied,
`CrmLead.organizationId` present before authorized apply, or any command other
than the authorized one would mutate production.

## CI note

No GitHub Actions workflow is required by this document. Validation scripts
`fr004:greenfield`, `fr004:prodsim`, `fr004:pending-proof`, and
`tenancy:validate-point8b1` are ready for manual/CI wiring later without
production secrets.
