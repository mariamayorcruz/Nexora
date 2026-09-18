# FR-004 — Migration integrity runbook

Repository-only remediation establishes a trusted Prisma baseline. **Production mutation is not authorized by merging the repository PR alone.**

## External baseline parity

**EXTERNAL_PRODUCTION_PARITY_REVIEW = PASS** for reviewed artifact/head:

`f272004413bc165da740d11c3e67f31a03da6a08`

Details: `docs/database/fr-004-baseline-review-checklist.md`.

Parity PASS does **not** authorize Production Authorization A or B.

## Concepts

| History | Role |
|---------|------|
| `prisma/migrations/` | Active Prisma replay: baseline + Slice 0 only |
| `prisma/migrations-legacy-pre-baseline/` | Frozen historical SQL evidence (not replayed) |
| `supabase/migrations/` | Supabase RLS / security history (separate from Prisma) |

- **Prisma migration history** = application schema
- **Supabase migration history** = RLS / security-specific history

Runtime tooling prints `baseline_parity_status=SEE_REVIEW_CHECKLIST` and does not certify parity itself.

## Active migrations

1. `20260918010000_baseline_production_pre_organization`
2. `20260918020000_add_organization_membership`

## `prisma migrate status` after squash

After Authorization A, production `_prisma_migrations` still contains six legacy ALTER-era rows that are **not** present in the active local folder. Prisma may report `historiesDiverge` / “migrations from the database are not found locally”.

That is **informational** for intentional squash/baselining.

**Do not** use a successful `prisma migrate status` as the production gate. Use:

```bash
FR004_DATABASE_URL=... npm run fr004:pending-proof -- --after-auth-a --allow-hosted-readonly
FR004_DATABASE_URL=... npm run fr004:preflight -- --allow-hosted-readonly --expect-baseline-applied
```

When `--allow-hosted-readonly` is set, **`FR004_DATABASE_URL` is required** (no fallback to `DATABASE_URL`). Prefer a least-privilege **read-only** credential for metadata inspection. Do not embed credentials in docs or scripts.

---

## Production Authorization A

**Status: BLOCKED** pending all of:

1. merged repository PR
2. backup / PITR verification (`VERIFY_BEFORE_EXECUTION`)
3. fresh production preflight (fail-closed legacy history + schema checks)
4. explicit authorization

Parity PASS alone is insufficient.

**Allowed (only after the above)**

```bash
prisma migrate resolve --applied 20260918010000_baseline_production_pre_organization
```

**Not allowed**

- `prisma migrate deploy`
- backfill
- any other schema mutation
- deleting/altering the six legacy `_prisma_migrations` rows
- `db push` / `migrate reset` / `migrate dev` against production

**Verification**

1. Six legacy rows remain unchanged (`finished_at` present, `rolled_back_at` null; `applied_steps_count = 0` on the first historical row is accepted)
2. Baseline row added and finished
3. Application schema unchanged (still no Organization / Membership / related enums)
4. Custom pending proof: pending local-active == Slice 0 only

---

## Production Authorization B

**Status: BLOCKED** separately until Authorization A is complete and verified, plus explicit DDL authorization.

**Preconditions**

- Authorization A completed and verified
- Custom pending-state proof PASS (`--after-auth-a`)
- Explicit separate authorization for DDL

**Allowed**

```bash
prisma migrate deploy
```

**Expected**

- Only `20260918020000_add_organization_membership` executes
- Organization / Membership / enums / indexes / FKs created

**Not allowed**

- Marking Slice 0 applied via `migrate resolve`
- Backfill
- Any other pending migration slipping through

**Verification**

1. Slice 0 row finished in `_prisma_migrations`
2. Six legacy + baseline rows still present/unchanged
3. Organization / Membership / enums exist
4. Runtime tenancy behavior still unchanged (userId authoritative)

---

## Backfill (separate later authorization)

Dry-run and `--apply` of legacy organization backfill are **not** part of FR-004 Auth A/B.

See `docs/point-7-slice-0.md`. Production backfill requires its own explicit approval after Auth B.

---

## Local / CI validation (repository)

```bash
# Empty disposable DB
FR004_DATABASE_URL=postgresql://... npm run fr004:greenfield

# Disposable prod-history simulation
FR004_DATABASE_URL=postgresql://... npm run fr004:prodsim
```

Scripts refuse obvious hosted/production URLs unless `--allow-hosted-readonly` is explicitly used with `FR004_DATABASE_URL`.

## Stop conditions

Stop closed if baseline ≠ production on material structure, Org/Membership already exist before Auth B, unexpected pending migrations, missing/unfinished/rolled-back legacy history rows, backup unavailable, or any command other than the authorized one would mutate production.

## CI note

No GitHub Actions workflow was added in this PR because the repository had no existing workflow directory to extend. Validation scripts `fr004:greenfield` and `fr004:prodsim` are ready for manual/CI wiring later without production secrets.
