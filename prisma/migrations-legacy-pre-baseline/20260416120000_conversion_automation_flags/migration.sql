-- Conversion automation: onboarding timestamp + sales recovery flags on LeadCapture
ALTER TABLE "User" ADD COLUMN "onboardingStartedAt" TIMESTAMP(3);

ALTER TABLE "LeadCapture" ADD COLUMN "needsSalesFollowup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LeadCapture" ADD COLUMN "salesFollowupMarkedAt" TIMESTAMP(3);

CREATE INDEX "LeadCapture_needsSalesFollowup_createdAt_idx" ON "LeadCapture"("needsSalesFollowup", "createdAt");
