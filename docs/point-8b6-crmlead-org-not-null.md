# Point 8B-6 — `CrmLead.organizationId` NOT NULL hardening

## Authorization boundary (current)

**Authorized now:** PRE-FLIGHT + DESIGN + VALIDATION + **controlled migration activation/apply** (this PR).

**NOT authorized:**

- Merge to `main` (until separately authorized)
- Point 8C / RLS / RBAC / Point 30
- Removing `userId`
- Migrating Campaign, LeadCapture, AdAccount, TenantAutomationConfig
- Production mutation outside versioned `prisma migrate deploy`

## Goal

Demonstrate that `CrmLead.organizationId` can move from **nullable → NOT NULL** safely, with measurable gates and a minimal reviewable migration.

## Current audited state (repo @ main after 8B-5C + 8B-3)

| Item | State |
|------|--------|
| Schema | `organizationId String?` (nullable) |
| FK | → `Organization.id` `ON DELETE RESTRICT` |
| Indexes | `(organizationId, updatedAt)`, `(organizationId, stage)`, `(userId)` |
| Active migrations | exactly 3 (baseline, Slice0, 8B-1) — **no 8B-6 active** |
| Point **8B-5C** | **MERGED** (PR #14) |
| Point **8B-3** tooling | **MERGED** (PR #16) |
| Hosted production nulls | **0** (SELECT-only preflight; see evidence) |
| Runtime CREATEs | all 5 stamp `organizationId` (see inventory below) |

## 8B-3 dependency status

| Item | Status |
|------|--------|
| PR #16 / 8B-3 tooling | **MERGED** into `main` |
| Production `--apply` of 8B-3 | **NOT executed** (not needed) |
| Production rows requiring backfill | **0** |

Hosted SELECT-only evidence (Nexora/Supabase, no writes):

```json
{
  "totalCrmLeads": 5,
  "nullOrganizationId": 0,
  "orphanOrganizationId": 0,
  "legacyMappingInconsistent": 0,
  "missingActiveMembership": 0,
  "organizationInactive": 0
}
```

Conclusion: production 8B-3 `--apply` is **unnecessary** and remains **unauthorized**. Numeric 8B-6 preflight blockers are already zero on hosted.

## Prerequisite gates (must all PASS before apply auth)

1. **Point 8B-3 dependency satisfied** — tooling merged **and** production read-only preflight proves `nullOrganizationId = 0` (done; no production apply required).
2. `npm run tenancy:preflight-point8b6` → PASS against the target DB (read-only SELECT).
3. `npm run tenancy:validate-point8b6` → PASS on disposable.
4. Prior tenancy validators remain green on disposable (incl. 8B-3 / 8B-5C).
5. FR-004 disposable suites remain green **while 8B-6 stays proposed-only** (not in `prisma/migrations`).
6. Explicit human authorization for: schema patch + activate migration + production apply.

## Preflight metrics

Script: `scripts/preflight-point8b6-crmlead-org-not-null.ts`

| Metric | Meaning | Gate |
|--------|---------|------|
| `totalCrmLeads` | All CRM leads | informational |
| `nullOrganizationId` | `organizationId IS NULL` | **must be 0** |
| `orphanOrganizationId` | non-null org id with no Organization row | **must be 0** |
| `legacyMappingInconsistent` | `legacy_org_*` ≠ `legacy_org_<userId>` | **must be 0** |
| `missingActiveMembership` | lead user lacks ACTIVE membership on lead org | **must be 0** |
| `organizationInactive` | org status ≠ ACTIVE | report **0** on target; policy counter |
| `withValidDeterministicOwnership` | residual valid rows | informational |

Hosted SELECT-only (never default): `POINT8B6_PREFLIGHT_ALLOW_HOSTED_READONLY=1`.

## CREATE path inventory (runtime)

| Path | Resolver | `organizationId` | `userId` provenance | Trusts `body.organizationId`? |
|------|----------|------------------|---------------------|-------------------------------|
| `POST /api/crm/leads` | `resolveCrmWriteOrganization` | TenantContext | actor userId | **No** |
| `POST /api/leads` | `resolveCrmWriteOrganization` | TenantContext | actor userId | **No** |
| `POST /api/business/leads` | `resolveCrmWriteOrganization` | TenantContext | actor userId | **No** |
| `POST /api/users/onboarding` sample | `resolveCrmWriteOrganization` (tx) | TenantContext | actor userId | **No** |
| Meta webhook | `resolveLegacyCrmWriteOrganization` | deterministic legacy org of `config.userId` | `TenantAutomationConfig.userId` | N/A |

No other `crmLead.create` under `src/`.

## Read / mutation impact of future NOT NULL

| Surface | Impact |
|---------|--------|
| CRM reads (`/api/crm/leads`, `/api/leads`) | Already `where: { organizationId }` — safer when column non-null |
| CRM PATCH / message | Lookup + update by `id + organizationId` — unchanged |
| Followups | Lead lookup org-scoped — unchanged |
| `/api/users/me` CRM counters | Org-scoped counts — unchanged |
| Meta duplicate detection | Org-scoped — unchanged |
| Admin `/api/admin/stats` | Intentional **global** exception — still valid with NOT NULL |

## Proposed migration SQL

File (proposed only):  
`docs/migrations/20261003120000_crmlead_organization_id_not_null.proposed.sql`

```sql
ALTER TABLE "CrmLead"
  ALTER COLUMN "organizationId" SET NOT NULL;
```

### Expected DB shape after authorized apply

```
CrmLead.userId          NOT NULL   (actor / provenance — retained)
CrmLead.organizationId  NOT NULL   (tenant ownership)
FK ON DELETE RESTRICT             (unchanged)
indexes                           (unchanged)
```

### Files required in a future apply PR (not this Design PR)

1. Move/activate SQL under `prisma/migrations/<timestamp>_crmlead_organization_id_not_null/`
2. `prisma/schema.prisma`: `organizationId String` + required `organization` relation
3. Update FR-004 expected active migration list (4 migrations)
4. Relax/update historical assertions in 8B-1/2/4/5 validators that freeze “exactly 3 migrations” / `String?`
5. Retire disposable tests that intentionally insert `organizationId: null`

## Failure conditions

| Condition | Result |
|-----------|--------|
| Any `organizationId IS NULL` | `SET NOT NULL` fails; preflight FAIL |
| Orphan org ids | FK/preflight FAIL |
| Legacy mapping inconsistent | preflight FAIL — do not apply |
| Runtime CREATE omitting org id after hardening | DB reject (desired) |
| Applying without zero-null preflight PASS | **NO-GO** |

## Rollback strategy

1. **Before apply:** no-op (proposed SQL not active).
2. **Immediately after apply (authorized window):**  
   `ALTER TABLE "CrmLead" ALTER COLUMN "organizationId" DROP NOT NULL;`  
   restores nullability. Does **not** delete data. Does **not** undo any prior 8B-3 backfill values.
3. **Schema rollback:** revert Prisma schema to `String?` + regenerate client in a follow-up PR.
4. **Data rollback of backfill:** out of scope for 8B-6; belongs to 8B-3 runbook if ever needed.

## Risks

1. Activating the migration in `prisma/migrations` without updating FR-004 / prior validators will break disposable suites.
2. Preview/shared DBs that apply migrations automatically must not receive this SQL until production authorization exists.
3. Multi-org leads with missing ACTIVE membership (revoked after write) fail the strict preflight membership gate — needs human triage before apply.
4. Hosted counters currently show zero blockers, but `SET NOT NULL` still requires explicit migration authorization (schema + active migration PR).

## Validation

```bash
FR004_DATABASE_URL=postgresql://... npm run tenancy:preflight-point8b6
FR004_DATABASE_URL=postgresql://... npm run tenancy:validate-point8b6
```

Also re-run: prisma validate/generate, tsc, lint, build, point8b3/8b5c/8b5/4/2, slice1a, FR-004 greenfield/prodsim.

## GO / NO-GO (Design phase recommendation)

| Question | Verdict |
|----------|---------|
| Runtime CREATE paths safe for NOT NULL? | **GO** (all stamp org id) |
| Design/migration SQL reviewable & minimal? | **GO** |
| Disposable proof that NOT NULL works post-backfill? | **GO** (validator) |
| 8B-3 dependency / zero-null hosted preflight | **GO** (merged + SELECT-only evidence) |
| Production migration apply / `SET NOT NULL` now? | **NO-GO** (needs separate apply authorization) |
| Merge of this design PR? | Pending separate authorization |

**Overall recommendation:**  
**READY FOR MIGRATION AUTHORIZATION** review (design + gates + evidence).  
**NOT authorized** to apply `SET NOT NULL`, mutate production, or merge until explicitly approved.
