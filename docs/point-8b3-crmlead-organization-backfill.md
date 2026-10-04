# Point 8B-3 — Historical `CrmLead.organizationId` backfill

## Authorization boundary (current)

**Authorized:** DESIGN + DRY-RUN + DISPOSABLE VALIDATION + hosted **SELECT-only** preflight evidence (this PR).

**NOT authorized:**

- Production mutation / production `--apply`
- Merge to `main` (until separately authorized)
- Point 8B-6 migration apply / `organizationId` NOT NULL
- Automatic Organization/Membership repair during backfill
- Campaign / LeadCapture / AdAccount / TenantAutomationConfig migration
- Point 8C / RLS / RBAC

## Goal

Safely backfill **only** historical rows:

```sql
CrmLead.organizationId IS NULL
```

using the authorized deterministic legacy mapping:

```text
CrmLead.userId → Organization.id = legacy_org_<userId>
```

## Mapping rules (fail closed)

For each NULL lead, before any write, validate:

1. User exists
2. Deterministic legacy Organization exists
3. Organization status is `ACTIVE`
4. Membership for `(organizationId, userId)` exists
5. Membership status is `ACTIVE`
6. Mapping is not ambiguous/inconsistent

If any check fails → **FAIL CLOSED** (zero writes).  
This script does **not** call `ensureUserOrganization` or otherwise repair tenant graph.

## Safety properties

| Property | Behavior |
|----------|----------|
| Default mode | DRY RUN |
| Explicit writes | `--apply` only |
| Target rows | `organizationId IS NULL` only |
| Non-null rows | Never updated |
| `userId` | Never changed |
| Transaction | Single `$transaction` for all updates |
| Partial writes | Forbidden (gate abort or rollback) |
| Idempotency | Second apply is a no-op when nulls are gone |
| Client/browser input | Not used |
| Runtime auth | Unchanged |

## Commands

```bash
# Dry-run (default) — disposable DB only
FR004_DATABASE_URL=postgresql://... npm run tenancy:backfill-crmlead-org

# Apply — disposable DB only (NOT production)
FR004_DATABASE_URL=postgresql://... npm run tenancy:backfill-crmlead-org -- --apply

# Validator
FR004_DATABASE_URL=postgresql://... npm run tenancy:validate-point8b3
```

## Dry-run output fields

- `totalCrmLeads`
- `nullOrganizationId`
- `alreadyAssigned`
- `rowsWouldUpdate`
- `missingOrganization`
- `inactiveOrganization`
- `missingMembership`
- `inactiveMembership`
- `userMissing`
- `ambiguousInconsistentMapping`
- `alreadyAssignedOrphanOrganization`
- `alreadyAssignedLegacyInconsistent`
- `alreadyAssignedMissingActiveMembership`
- `gate.pass` / `gate.failures`

Apply also requires a clean assigned-row integrity set so post-apply Point **8B-6** readiness can pass.

## Apply post-conditions (8B-6 readiness)

After successful disposable `--apply`:

- `nullOrganizationId = 0`
- `orphanOrganizationId = 0`
- `legacyMappingInconsistent = 0`
- `missingActiveMembership = 0`

## Rollback

1. **Dry-run:** no-op.
2. **After disposable apply:** restore from disposable DB snapshot / recreate fixtures (no production impact).
3. **If ever authorized on production (future):** restore from pre-apply backup, or targeted `UPDATE` only with a separately authorized runbook. Prefer backup restore. This Design PR does not ship a destructive undo script.

## Risks

1. Environments where Slice-0 legacy Organization/Membership backfill was incomplete will FAIL CLOSED until repaired by the dedicated tenant backfill (not this script).
2. Pre-existing **non-null** inconsistent leads block apply (by design) so 8B-6 gates stay honest.
3. Hosted production currently shows **zero** null `organizationId` rows (see evidence below); production `--apply` remains unauthorized and is **not needed** at this time.

## Hosted production evidence (SELECT-only)

Executed against Nexora/Supabase with **read-only** SQL (no writes, no `--apply`):

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

| Conclusion | Status |
|------------|--------|
| Production rows requiring 8B-3 backfill | **0** |
| Production `--apply` needed now | **No** |
| Production `--apply` authorized | **No** |

## Relation to Point 8B-6

Successful 8B-3 apply (disposable / future authorized environments with nulls) satisfies the 8B-6 preflight blockers for null/orphan/legacy/membership.  
It does **not** authorize 8B-6 schema NOT NULL activation (PR #15 remains design-only).  
Current hosted counters already meet the numeric 8B-6 readiness zeros; that still does **not** authorize 8B-6 apply.

## GO / NO-GO

| Question | Verdict |
|----------|---------|
| Design + disposable dry-run/apply/validator | **GO** |
| Hosted read-only production preflight | **DONE** (SELECT-only; see evidence) |
| Production `--apply` | **NO-GO** (not needed; 0 nulls) |
| Merge | Pending separate authorization |
| Activate 8B-6 NOT NULL | **NO-GO** |
