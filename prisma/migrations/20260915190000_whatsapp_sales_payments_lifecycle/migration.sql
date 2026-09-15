-- CRM lead: datos para ciclo de vida y localización
ALTER TABLE "CrmLead" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);
ALTER TABLE "CrmLead" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "CrmLead" ADD COLUMN IF NOT EXISTS "locale" TEXT;
ALTER TABLE "CrmLead" ADD COLUMN IF NOT EXISTS "optOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CrmLead" ADD COLUMN IF NOT EXISTS "lifecyclePausedAt" TIMESTAMP(3);

-- Configuración del tenant: país, horario y controles del asistente
ALTER TABLE "tenant_automation_configs" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'CL';
ALTER TABLE "tenant_automation_configs" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/Santiago';
ALTER TABLE "tenant_automation_configs" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'CLP';
ALTER TABLE "tenant_automation_configs" ADD COLUMN IF NOT EXISTS "business_hours_start" INTEGER NOT NULL DEFAULT 9;
ALTER TABLE "tenant_automation_configs" ADD COLUMN IF NOT EXISTS "business_hours_end" INTEGER NOT NULL DEFAULT 21;
ALTER TABLE "tenant_automation_configs" ADD COLUMN IF NOT EXISTS "ai_auto_reply" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tenant_automation_configs" ADD COLUMN IF NOT EXISTS "ai_can_close" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tenant_automation_configs" ADD COLUMN IF NOT EXISTS "escalation_keywords" TEXT;

-- Catálogo
CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Product_userId_active_idx" ON "Product"("userId", "active");

-- Cuentas de cobro de cada cliente (credenciales cifradas)
CREATE TABLE IF NOT EXISTS "PaymentAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "credentials" JSONB NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "country" TEXT NOT NULL DEFAULT 'CL',
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentAccount_userId_provider_key" ON "PaymentAccount"("userId", "provider");
CREATE INDEX IF NOT EXISTS "PaymentAccount_userId_connected_idx" ON "PaymentAccount"("userId", "connected");

-- Cupones (cumpleaños y promociones)
CREATE TABLE IF NOT EXISTS "Coupon" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" TEXT,
    "code" TEXT NOT NULL,
    "percentOff" INTEGER NOT NULL DEFAULT 10,
    "reason" TEXT NOT NULL DEFAULT 'birthday',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX IF NOT EXISTS "Coupon_userId_reason_idx" ON "Coupon"("userId", "reason");

-- Órdenes
CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" TEXT,
    "productId" TEXT,
    "couponId" TEXT,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "reference" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Order_reference_key" ON "Order"("reference");
CREATE INDEX IF NOT EXISTS "Order_userId_status_idx" ON "Order"("userId", "status");
CREATE INDEX IF NOT EXISTS "Order_providerRef_idx" ON "Order"("providerRef");

-- Conversaciones de WhatsApp
CREATE TABLE IF NOT EXISTS "WaConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" TEXT,
    "phone" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'open',
    "aiPaused" BOOLEAN NOT NULL DEFAULT false,
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WaConversation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WaConversation_userId_phone_key" ON "WaConversation"("userId", "phone");
CREATE INDEX IF NOT EXISTS "WaConversation_userId_state_idx" ON "WaConversation"("userId", "state");

CREATE TABLE IF NOT EXISTS "WaMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "waMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WaMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WaMessage_waMessageId_key" ON "WaMessage"("waMessageId");
CREATE INDEX IF NOT EXISTS "WaMessage_conversationId_createdAt_idx" ON "WaMessage"("conversationId", "createdAt");

-- Campañas de ciclo de vida
CREATE TABLE IF NOT EXISTS "LifecycleRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "delayDays" INTEGER NOT NULL DEFAULT 3,
    "intervalDays" INTEGER NOT NULL DEFAULT 30,
    "maxSends" INTEGER NOT NULL DEFAULT 6,
    "template" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "couponValidDays" INTEGER NOT NULL DEFAULT 7,
    "sendHour" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LifecycleRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LifecycleRule_userId_kind_key" ON "LifecycleRule"("userId", "kind");

CREATE TABLE IF NOT EXISTS "LifecycleSend" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sentOn" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LifecycleSend_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LifecycleSend_leadId_kind_sentOn_key" ON "LifecycleSend"("leadId", "kind", "sentOn");
CREATE INDEX IF NOT EXISTS "LifecycleSend_userId_createdAt_idx" ON "LifecycleSend"("userId", "createdAt");

-- Bloqueo de tareas programadas
CREATE TABLE IF NOT EXISTS "JobLock" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobLock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobLock_name_key" ON "JobLock"("name");

-- Auditoría
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- Llaves foráneas
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_userId_fkey";
ALTER TABLE "Product" ADD CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentAccount" DROP CONSTRAINT IF EXISTS "PaymentAccount_userId_fkey";
ALTER TABLE "PaymentAccount" ADD CONSTRAINT "PaymentAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Coupon" DROP CONSTRAINT IF EXISTS "Coupon_userId_fkey";
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Coupon" DROP CONSTRAINT IF EXISTS "Coupon_leadId_fkey";
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_userId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_leadId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_productId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_couponId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WaConversation" DROP CONSTRAINT IF EXISTS "WaConversation_userId_fkey";
ALTER TABLE "WaConversation" ADD CONSTRAINT "WaConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaConversation" DROP CONSTRAINT IF EXISTS "WaConversation_leadId_fkey";
ALTER TABLE "WaConversation" ADD CONSTRAINT "WaConversation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WaMessage" DROP CONSTRAINT IF EXISTS "WaMessage_conversationId_fkey";
ALTER TABLE "WaMessage" ADD CONSTRAINT "WaMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WaConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LifecycleRule" DROP CONSTRAINT IF EXISTS "LifecycleRule_userId_fkey";
ALTER TABLE "LifecycleRule" ADD CONSTRAINT "LifecycleRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LifecycleSend" DROP CONSTRAINT IF EXISTS "LifecycleSend_userId_fkey";
ALTER TABLE "LifecycleSend" ADD CONSTRAINT "LifecycleSend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LifecycleSend" DROP CONSTRAINT IF EXISTS "LifecycleSend_leadId_fkey";
ALTER TABLE "LifecycleSend" ADD CONSTRAINT "LifecycleSend_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
