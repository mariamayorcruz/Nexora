-- Point 8B-1: CrmLead organization tenancy foundation (additive only).
-- Adds nullable organizationId for future Organization-scoped ownership.
-- Does NOT backfill organizationId.
-- Does NOT change userId (remains NOT NULL / runtime-authoritative until later slices).
-- Does NOT implement dual-write, read cutover, multi-org CRM writes, or NOT NULL.

-- AlterTable
ALTER TABLE "CrmLead" ADD COLUMN "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "CrmLead_organizationId_updatedAt_idx" ON "CrmLead"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "CrmLead_organizationId_stage_idx" ON "CrmLead"("organizationId", "stage");

-- CreateIndex
CREATE INDEX "CrmLead_userId_idx" ON "CrmLead"("userId");

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
