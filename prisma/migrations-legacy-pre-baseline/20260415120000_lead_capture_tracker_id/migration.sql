-- Link LeadCapture to attribution session via tracker cookie (nxa_tid → AttributionSession.trackerId)
ALTER TABLE "LeadCapture" ADD COLUMN "trackerId" TEXT;

CREATE INDEX "LeadCapture_trackerId_idx" ON "LeadCapture"("trackerId");
