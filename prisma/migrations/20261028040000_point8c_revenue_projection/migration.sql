-- Point 8C: additive Stripe revenue projection.
-- Nullable subscription/invoice columns keep existing rows unverified.
-- Does not add organizationId and does not alter CrmLead, RLS, or historical migrations.

ALTER TABLE "Subscription"
  ADD COLUMN "stripeStatus" TEXT,
  ADD COLUMN "billingInterval" TEXT,
  ADD COLUMN "billingIntervalCount" INTEGER,
  ADD COLUMN "recurringAmountMinor" BIGINT,
  ADD COLUMN "currency" TEXT,
  ADD COLUMN "stripePriceId" TEXT,
  ADD COLUMN "sourceEventCreated" INTEGER;

ALTER TABLE "Invoice"
  ADD COLUMN "amountMinor" BIGINT,
  ADD COLUMN "sourceEventCreated" INTEGER;

CREATE TABLE "StripeWebhookEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "livemode" BOOLEAN NOT NULL,
  "stripeCreated" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PendingStripeInvoice" (
  "stripeInvoiceId" TEXT NOT NULL,
  "stripeCustomerId" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "description" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "hostedInvoiceUrl" TEXT,
  "invoicePdfUrl" TEXT,
  "sourceEventCreated" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PendingStripeInvoice_pkey" PRIMARY KEY ("stripeInvoiceId")
);

CREATE INDEX "PendingStripeInvoice_stripeCustomerId_idx"
  ON "PendingStripeInvoice"("stripeCustomerId");
