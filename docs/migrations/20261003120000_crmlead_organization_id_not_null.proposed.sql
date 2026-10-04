-- Point 8B-6 PROPOSED → ACTIVATED reference copy.
-- Active migration:
--   prisma/migrations/20261004120000_crmlead_organization_id_not_null/migration.sql
--
-- Exact SQL (unchanged):

ALTER TABLE "CrmLead"
  ALTER COLUMN "organizationId" SET NOT NULL;

-- Rollback (do not run unless authorized):
-- ALTER TABLE "CrmLead" ALTER COLUMN "organizationId" DROP NOT NULL;
