-- Point 8B-6 PROPOSED migration (NOT ACTIVE in prisma/migrations).
-- Authorization boundary: PRE-FLIGHT + DESIGN + VALIDATION only.
-- Do NOT apply to production until explicitly authorized.
--
-- Scope (minimal):
--   CrmLead.organizationId  NULLABLE → NOT NULL
--
-- Prerequisites (hard gates — fail closed):
--   1. Point 8B-3 tooling MERGED (PR #16). Production SELECT-only preflight already
--      proves nullOrganizationId = 0 (production --apply not needed / not authorized).
--   2. preflight-point8b6 reports:
--        nullOrganizationId = 0
--        orphanOrganizationId = 0
--        legacyMappingInconsistent = 0
--        missingActiveMembership = 0
--        organizationInactive = 0 (report/policy)
--   3. All runtime CREATE paths stamp organizationId (validated by tenancy:validate-point8b6)
--   4. Active Prisma schema updated in the same authorized apply PR:
--        organizationId String
--        organization   Organization @relation(...)
--
-- Explicit non-scope:
--   - NO userId removal
--   - NO Campaign / LeadCapture / AdAccount / TenantAutomationConfig changes
--   - NO RLS / RBAC / Point 30 / Point 8C
--   - NO backfill inside this statement (backfill is Point 8B-3; not needed on prod now)

-- Fail closed if any NULL remains (PostgreSQL will reject SET NOT NULL otherwise).
-- Operators should run scripts/preflight-point8b6-crmlead-org-not-null.ts first.

ALTER TABLE "CrmLead"
  ALTER COLUMN "organizationId" SET NOT NULL;

-- Expected post-apply shape:
--   CrmLead.userId          NOT NULL  (unchanged; actor/provenance)
--   CrmLead.organizationId  NOT NULL  (tenant ownership)
--   FK CrmLead_organizationId_fkey → Organization(id) ON DELETE RESTRICT (unchanged)
--   indexes on (organizationId, updatedAt), (organizationId, stage), (userId) unchanged
