# FR-004 — Baseline review checklist

**Status marker:** `EXTERNAL_PRODUCTION_PARITY_REVIEW_REQUIRED`

Cursor / this repository PR does **not** have an authorized production database connection. The baseline candidate was generated from:

1. current `schema.prisma` with Organization / Membership / related enums excluded
2. repository SQL / migration evidence (including absorbed `tenant_automation_configs`)

Independent reviewers must compare this checklist against **live production metadata** before merge approval for production Auth A.

Baseline path:

`prisma/migrations/20260918010000_baseline_production_pre_organization/migration.sql`

For each table below, verify against production:

| Check | Notes |
|-------|-------|
| table name | exact |
| columns | names + order awareness |
| types | PostgreSQL types |
| nullability | NULL / NOT NULL |
| defaults | expressions |
| PK | columns |
| unique constraints | including composite |
| foreign keys | columns + referenced table |
| onDelete / onUpdate | Cascade / SetNull / Restrict / etc. |
| indexes | unique and non-unique |

## Pre-Organization application tables

- [ ] User
- [ ] Subscription
- [ ] AdAccount
- [ ] Campaign
- [ ] Analytics
- [ ] Invoice
- [ ] CrmLead
- [ ] CrmWorkspaceSettings
- [ ] tenant_automation_configs
- [ ] AiWorkspaceUsage
- [ ] AiWorkspaceJob
- [ ] AiVideoProject
- [ ] AiVideoProjectVersion
- [ ] AiVideoAsset
- [ ] LeadCapture
- [ ] VerificationToken
- [ ] PaymentSettings
- [ ] ConnectionRequest
- [ ] AdminWorkspaceConfig
- [ ] AttributionSession
- [ ] AttributionEvent

## Must be ABSENT from baseline

- [ ] Organization
- [ ] Membership
- [ ] OrganizationStatus
- [ ] MembershipRole
- [ ] MembershipStatus
- [ ] `_prisma_migrations` DDL
- [ ] RLS policies
- [ ] Supabase `auth` / `storage` / `realtime` internals

## Special attention

- [ ] `tenant_automation_configs` columns/maps match production (snake_case)
- [ ] `tenant_automation_configs.user_id` FK → `User.id` ON DELETE CASCADE
- [ ] LeadCapture paid / tracker / sales-recovery columns present
- [ ] Invoice hosted URL / PDF URL columns present
- [ ] User onboarding columns present

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| External production parity reviewer | | | PASS / FAIL |

Only after PASS should Production Authorization A be considered.
