-- Track first sales recovery email per LeadCapture row
ALTER TABLE "LeadCapture" ADD COLUMN "salesRecoveryFollowupSentAt" TIMESTAMP(3);

CREATE INDEX "LeadCapture_needsSalesFollowup_salesRecoveryFollowupSentAt_idx" ON "LeadCapture"("needsSalesFollowup", "salesRecoveryFollowupSentAt");
