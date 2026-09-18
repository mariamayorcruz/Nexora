-- FR-004 baseline: application schema BEFORE Organization/Membership.
-- Candidate generated from schema.prisma (Slice 0 models excluded) + repository evidence.
-- BASELINE_REQUIRES_EXTERNAL_PRODUCTION_PARITY_REVIEW
-- Excludes: Organization, Membership, related enums, _prisma_migrations, RLS, Supabase internals.

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "marketingOptInAt" TIMESTAMP(3),
    "nurtureStatus" TEXT NOT NULL DEFAULT 'not-consented',
    "lastNurtureSentAt" TIMESTAMP(3),
    "nextNurtureSendAt" TIMESTAMP(3),
    "onboardingStartedAt" TIMESTAMP(3),
    "onboardingCompletedAt" TIMESTAMP(3),
    "onboardingData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "status" TEXT NOT NULL DEFAULT 'incomplete',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerId" TEXT,
    "stripeSubId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "accountName" TEXT NOT NULL,
    "accountEmail" TEXT,
    "connected" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "budget" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "targeting" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analytics" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "status" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "hostedInvoiceUrl" TEXT,
    "invoicePdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmLead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "stage" TEXT NOT NULL DEFAULT 'lead',
    "status" TEXT NOT NULL DEFAULT 'nuevo',
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" INTEGER NOT NULL DEFAULT 25,
    "nextAction" TEXT,
    "notes" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmWorkspaceSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailAutomationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "phoneEnabled" BOOLEAN NOT NULL DEFAULT false,
    "externalCrmEnabled" BOOLEAN NOT NULL DEFAULT false,
    "externalCrmName" TEXT,
    "autoFollowUpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultCadence" TEXT NOT NULL DEFAULT '48h',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmWorkspaceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_automation_configs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "whatsapp_phone_number_id" TEXT,
    "whatsapp_access_token" TEXT,
    "meta_ads_account_id" TEXT,
    "meta_ads_token" TEXT,
    "open_phone_api_key" TEXT,
    "open_phone_number_id" TEXT,
    "whatsapp_connected" BOOLEAN NOT NULL DEFAULT false,
    "meta_connected" BOOLEAN NOT NULL DEFAULT false,
    "open_phone_connected" BOOLEAN NOT NULL DEFAULT false,
    "instagram_connected" BOOLEAN NOT NULL DEFAULT false,
    "business_name" TEXT,
    "welcome_message" TEXT,
    "qualification_prompt" TEXT,
    "ai_tone" TEXT NOT NULL DEFAULT 'professional',
    "language" TEXT NOT NULL DEFAULT 'es',
    "hot_lead_action" TEXT NOT NULL DEFAULT 'notify',
    "warm_lead_action" TEXT NOT NULL DEFAULT 'sequence',
    "cold_lead_action" TEXT NOT NULL DEFAULT 'sequence',
    "followup_days" INTEGER NOT NULL DEFAULT 3,
    "automation_active" BOOLEAN NOT NULL DEFAULT false,
    "n8n_webhook_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_automation_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiWorkspaceUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleKey" TEXT NOT NULL,
    "cycleStart" TIMESTAMP(3) NOT NULL,
    "cycleEnd" TIMESTAMP(3) NOT NULL,
    "creditsIncluded" INTEGER NOT NULL,
    "creditsPurchased" INTEGER NOT NULL DEFAULT 0,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "lastJobAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiWorkspaceUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiWorkspaceJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "channel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "creditsUsed" INTEGER NOT NULL,
    "output" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiWorkspaceJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiVideoProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tool" TEXT NOT NULL DEFAULT 'text-to-video',
    "prompt" TEXT NOT NULL,
    "outputFormat" TEXT NOT NULL DEFAULT 'vertical 9:16',
    "captionStyle" TEXT NOT NULL DEFAULT 'bold clean',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "timeline" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiVideoProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiVideoProjectVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "note" TEXT,
    "timeline" JSONB NOT NULL,
    "renderPlan" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiVideoProjectVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiVideoAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'library',
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "relativeUrl" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiVideoAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCapture" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "source" TEXT NOT NULL DEFAULT 'masterclass',
    "resource" TEXT NOT NULL DEFAULT 'el-mapa-de-decisiones-48-horas',
    "userId" TEXT,
    "crmLeadId" TEXT,
    "convertedToCrmAt" TIMESTAMP(3),
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "convertedToPaidAt" TIMESTAMP(3),
    "trackerId" TEXT,
    "needsSalesFollowup" BOOLEAN NOT NULL DEFAULT false,
    "salesFollowupMarkedAt" TIMESTAMP(3),
    "salesRecoveryFollowupSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadCapture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "PaymentSettings" (
    "id" TEXT NOT NULL,
    "stripeWebhookSecret" TEXT,
    "bankAccount" JSONB,
    "paypalEmail" TEXT,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 2.9,
    "minimumPayout" DOUBLE PRECISION NOT NULL DEFAULT 25.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "businessName" TEXT,
    "contactEmail" TEXT,
    "adAccountLabel" TEXT,
    "websiteUrl" TEXT,
    "notes" TEXT,
    "setupPreference" TEXT NOT NULL DEFAULT 'oauth',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminWorkspaceConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'main',
    "funnelConfig" JSONB,
    "emailTemplates" JSONB,
    "automationConfig" JSONB,
    "roadmapConfig" JSONB,
    "platformConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminWorkspaceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributionSession" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "landingPath" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "gclid" TEXT,
    "fbclid" TEXT,
    "ttclid" TEXT,
    "msclkid" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consentStatus" TEXT NOT NULL DEFAULT 'unknown',
    "consentUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttributionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributionEvent" (
    "id" TEXT NOT NULL,
    "attributionSessionId" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'custom',
    "path" TEXT,
    "source" TEXT,
    "value" DOUBLE PRECISION,
    "currency" TEXT,
    "dedupKey" TEXT NOT NULL,
    "payload" JSONB,
    "eventTs" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubId_key" ON "Subscription"("stripeSubId");

-- CreateIndex
CREATE UNIQUE INDEX "AdAccount_userId_platform_accountId_key" ON "AdAccount"("userId", "platform", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Analytics_campaignId_key" ON "Analytics"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stripeInvoiceId_key" ON "Invoice"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmWorkspaceSettings_userId_key" ON "CrmWorkspaceSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_automation_configs_user_id_key" ON "tenant_automation_configs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "AiWorkspaceUsage_userId_cycleKey_key" ON "AiWorkspaceUsage"("userId", "cycleKey");

-- CreateIndex
CREATE INDEX "AiVideoProject_userId_updatedAt_idx" ON "AiVideoProject"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AiVideoProjectVersion_userId_createdAt_idx" ON "AiVideoProjectVersion"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiVideoProjectVersion_projectId_version_key" ON "AiVideoProjectVersion"("projectId", "version");

-- CreateIndex
CREATE INDEX "AiVideoAsset_userId_createdAt_idx" ON "AiVideoAsset"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiVideoAsset_userId_status_idx" ON "AiVideoAsset"("userId", "status");

-- CreateIndex
CREATE INDEX "LeadCapture_email_source_idx" ON "LeadCapture"("email", "source");

-- CreateIndex
CREATE INDEX "LeadCapture_paid_idx" ON "LeadCapture"("paid");

-- CreateIndex
CREATE INDEX "LeadCapture_trackerId_idx" ON "LeadCapture"("trackerId");

-- CreateIndex
CREATE INDEX "LeadCapture_needsSalesFollowup_createdAt_idx" ON "LeadCapture"("needsSalesFollowup", "createdAt");

-- CreateIndex
CREATE INDEX "LeadCapture_needsSalesFollowup_salesRecoveryFollowupSentAt_idx" ON "LeadCapture"("needsSalesFollowup", "salesRecoveryFollowupSentAt");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "ConnectionRequest_userId_platform_status_idx" ON "ConnectionRequest"("userId", "platform", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AdminWorkspaceConfig_key_key" ON "AdminWorkspaceConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AttributionSession_trackerId_key" ON "AttributionSession"("trackerId");

-- CreateIndex
CREATE UNIQUE INDEX "AttributionSession_sessionKey_key" ON "AttributionSession"("sessionKey");

-- CreateIndex
CREATE INDEX "AttributionSession_createdAt_idx" ON "AttributionSession"("createdAt");

-- CreateIndex
CREATE INDEX "AttributionSession_utmSource_utmCampaign_idx" ON "AttributionSession"("utmSource", "utmCampaign");

-- CreateIndex
CREATE UNIQUE INDEX "AttributionEvent_dedupKey_key" ON "AttributionEvent"("dedupKey");

-- CreateIndex
CREATE INDEX "AttributionEvent_attributionSessionId_eventTs_idx" ON "AttributionEvent"("attributionSessionId", "eventTs");

-- CreateIndex
CREATE INDEX "AttributionEvent_eventName_createdAt_idx" ON "AttributionEvent"("eventName", "createdAt");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analytics" ADD CONSTRAINT "Analytics_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmWorkspaceSettings" ADD CONSTRAINT "CrmWorkspaceSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_automation_configs" ADD CONSTRAINT "tenant_automation_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWorkspaceUsage" ADD CONSTRAINT "AiWorkspaceUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWorkspaceJob" ADD CONSTRAINT "AiWorkspaceJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiVideoProject" ADD CONSTRAINT "AiVideoProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiVideoProjectVersion" ADD CONSTRAINT "AiVideoProjectVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AiVideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiVideoProjectVersion" ADD CONSTRAINT "AiVideoProjectVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiVideoAsset" ADD CONSTRAINT "AiVideoAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCapture" ADD CONSTRAINT "LeadCapture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "ConnectionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionEvent" ADD CONSTRAINT "AttributionEvent_attributionSessionId_fkey" FOREIGN KEY ("attributionSessionId") REFERENCES "AttributionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

