-- Funnel admin: capturas marcadas como pagadas (vista global admin)
ALTER TABLE "LeadCapture" ADD COLUMN "paid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LeadCapture" ADD COLUMN "convertedToPaidAt" TIMESTAMP(3);

CREATE INDEX "LeadCapture_paid_idx" ON "LeadCapture"("paid");
