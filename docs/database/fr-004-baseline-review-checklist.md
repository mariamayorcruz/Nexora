# FR-004 — Baseline review checklist

**EXTERNAL_PRODUCTION_PARITY_REVIEW = PASS**

Reviewed repository artifact / PR head:

`f272004413bc165da740d11c3e67f31a03da6a08`

Baseline path:

`prisma/migrations/20260918010000_baseline_production_pre_organization/migration.sql`

Compared independently against active Nexora Supabase **production metadata** (structure only; no customer row inspection).

## Verified scope (PASS)

- 21/21 expected pre-Organization application tables present; no missing / no extra application tables
- Column names, types, nullability, and defaults match materially
- All primary keys match
- All expected indexes / unique indexes match
- All foreign keys and referential actions match semantically
- `tenant_automation_configs` matches production structure
- Organization / Membership absent
- OrganizationStatus / MembershipRole / MembershipStatus absent
- Eight archived migration SQL copies byte-identical to historical sources
- Active Slice 0 migration byte-identical to main
- Active migrations = baseline + Slice 0 only
- RLS intentionally excluded from Prisma baseline (Supabase-managed)

## Non-material notes

Physical column-order differences exist in:

- User
- Invoice
- CrmLead
- LeadCapture
- AdminWorkspaceConfig

These reflect historical ALTER ordering and are **not** schema-parity failures.

## Review checklist (completed)

For each table, production metadata was checked for: name, columns, types, nullability, defaults, PK, unique constraints, FKs, onDelete/onUpdate, indexes.

### Pre-Organization application tables

- [x] User
- [x] Subscription
- [x] AdAccount
- [x] Campaign
- [x] Analytics
- [x] Invoice
- [x] CrmLead
- [x] CrmWorkspaceSettings
- [x] tenant_automation_configs
- [x] AiWorkspaceUsage
- [x] AiWorkspaceJob
- [x] AiVideoProject
- [x] AiVideoProjectVersion
- [x] AiVideoAsset
- [x] LeadCapture
- [x] VerificationToken
- [x] PaymentSettings
- [x] ConnectionRequest
- [x] AdminWorkspaceConfig
- [x] AttributionSession
- [x] AttributionEvent

### Must be ABSENT from baseline (verified)

- [x] Organization
- [x] Membership
- [x] OrganizationStatus
- [x] MembershipRole
- [x] MembershipStatus
- [x] `_prisma_migrations` DDL
- [x] RLS policies
- [x] Supabase `auth` / `storage` / `realtime` internals

## Sign-off

| Role | Result | Reviewed head |
|------|--------|---------------|
| External production parity reviewer | **PASS** | `f272004413bc165da740d11c3e67f31a03da6a08` |

**Important:** Parity PASS does **not** authorize Production Authorization A by itself. Auth A still requires merged repository PR, backup/PITR verification, fresh production preflight, and explicit authorization.
