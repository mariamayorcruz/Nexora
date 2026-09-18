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
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_automation_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_automation_configs_user_id_key" ON "tenant_automation_configs"("user_id");

ALTER TABLE "tenant_automation_configs"
ADD CONSTRAINT "tenant_automation_configs_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
