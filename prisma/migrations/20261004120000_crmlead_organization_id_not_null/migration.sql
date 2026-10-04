-- Point 8B-6: CrmLead.organizationId nullable → NOT NULL
-- Minimal hardening only. No userId/other-model/RLS changes.

ALTER TABLE "CrmLead"
  ALTER COLUMN "organizationId" SET NOT NULL;
