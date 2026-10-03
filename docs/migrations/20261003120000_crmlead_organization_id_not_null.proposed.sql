-- Point 8B-6 PROPOSED migration (NOT ACTIVE in prisma/migrations).
-- Authorization boundary: PRE-FLIGHT + DESIGN + VALIDATION only.
-- Do NOT apply to production until explicitly authorized.
--
-- Scope (minimal):
--   CrmLead.organizationId  NULLABLE → NOT NULL
--
-- Prerequisites (hard gates — fail closed):
--   1. Point 8B-3 backfill completed OR production preflight proves zero NULL organizationId
--   2. preflight-point8b6 reports:
--        nullOrganizationId = 0
--        orphanOrganizationId = 0
--        invalidOrganizationStatus (optional policy) accepted
--        legacyMappingInconsistent = 0  (or explicitly waived)
--        missingActiveMembership = 0    (or explicitly waived for approved exceptions)
--   3. All runtime CREATE paths stamp organizationId (validated by tenancy:validate-point8b6)
--   4. Active Prisma schema updated in the same authorized apply PR:
--        organizationId String
--        organization   Organization @relation(...)
--
-- Explicit non-scope:
--   - NO userId removal
--   - NO Campaign / LeadCapture / AdAccount / TenantAutomationConfig changes
--   - NO RLS / RBAC / Point 30 / Point 8C
--   - NO backfill inside this statement (backfill is Point 8B-3)

-- Fail closed if any NULL remains (PostgreSQL will reject SET NOT NULL otherwise).
-- Operators should run scripts/preflight-point8b6-crmlead-org-not-null.ts first.

ALTER TABLE "CrmLead"
  ALTER COLUMN "organizationId" SET NOT NULL;

-- Expected post-apply shape:
--   CrmLead.userId          NOT NULL  (unchanged; actor/provenance)
--   CrmLead.organizationId  NOT NULL  (tenant ownership)
--   FK CrmLead_organizationId_fkey → Organization(id) ON DELETE RESTRICT (unchanged)
--   indexes on (organizationId, updatedAt), (organizationId, stage), (userId) unchanged
