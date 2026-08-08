-- Billing & Finance: PaymentMethod, gateway status, dunning, subscriptions remap

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BANK_ACCOUNTS_MANAGER';

CREATE TYPE "PaymentMethod" AS ENUM (
  'RAZORPAY',
  'PAYU',
  'BANK_TRANSFER',
  'CHEQUE',
  'CASH',
  'CREDIT_NOTE',
  'ADJUSTMENT'
);

CREATE TYPE "PaymentGatewayStatus" AS ENUM (
  'INITIATED',
  'PROCESSING',
  'CAPTURED',
  'FAILED',
  'REFUNDED',
  'PARTIAL_REFUND'
);

CREATE TYPE "DunningStage" AS ENUM (
  'NONE',
  'REMINDER_1',
  'REMINDER_2',
  'FINAL_NOTICE',
  'ESCALATED',
  'WRITE_OFF'
);

-- Invoice additions
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "gatewayOrderId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "gatewayPaymentId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "dunningStage" "DunningStage" NOT NULL DEFAULT 'NONE';
CREATE INDEX IF NOT EXISTS "Invoice_dunningStage_idx" ON "Invoice"("dunningStage");
CREATE INDEX IF NOT EXISTS "Invoice_subscriptionId_idx" ON "Invoice"("subscriptionId");
CREATE INDEX IF NOT EXISTS "Invoice_gatewayPaymentId_idx" ON "Invoice"("gatewayPaymentId");

-- Payment enhancements
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER';
ALTER TABLE "Payment" ALTER COLUMN "mode" DROP NOT NULL;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "gatewayStatus" "PaymentGatewayStatus";
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Backfill method from mode where possible
UPDATE "Payment" SET "method" = CASE "mode"::text
  WHEN 'CASH' THEN 'CASH'::"PaymentMethod"
  WHEN 'CHEQUE' THEN 'CHEQUE'::"PaymentMethod"
  WHEN 'NEFT' THEN 'BANK_TRANSFER'::"PaymentMethod"
  WHEN 'RTGS' THEN 'BANK_TRANSFER'::"PaymentMethod"
  WHEN 'IMPS' THEN 'BANK_TRANSFER'::"PaymentMethod"
  ELSE 'BANK_TRANSFER'::"PaymentMethod"
END
WHERE "method" = 'BANK_TRANSFER';

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_gatewayTxnId_key" UNIQUE ("gatewayTxnId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX IF NOT EXISTS "Payment_method_idx" ON "Payment"("method");
CREATE INDEX IF NOT EXISTS "Payment_paidAt_idx" ON "Payment"("paidAt");

CREATE TABLE IF NOT EXISTS "PaymentGatewayLog" (
  "id" TEXT NOT NULL,
  "gateway" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "gatewayPaymentId" TEXT,
  "gatewayOrderId" TEXT,
  "invoiceId" TEXT,
  "payload" JSONB NOT NULL,
  "signatureValid" BOOLEAN,
  "processed" BOOLEAN NOT NULL DEFAULT false,
  "errorMessage" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentGatewayLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PaymentGatewayLog_gateway_gatewayPaymentId_idx"
  ON "PaymentGatewayLog"("gateway", "gatewayPaymentId");
CREATE INDEX IF NOT EXISTS "PaymentGatewayLog_invoiceId_idx" ON "PaymentGatewayLog"("invoiceId");
CREATE INDEX IF NOT EXISTS "PaymentGatewayLog_receivedAt_idx" ON "PaymentGatewayLog"("receivedAt");

-- SubscriptionType remap
CREATE TYPE "SubscriptionType_new" AS ENUM (
  'STORAGE_ANNUAL',
  'STORAGE_MONTHLY',
  'MEMBERSHIP_BASIC',
  'MEMBERSHIP_PREMIUM'
);

ALTER TABLE "Subscription" ALTER COLUMN "type" TYPE TEXT USING "type"::text;
UPDATE "Subscription" SET "type" = CASE "type"
  WHEN 'STORAGE_SEMEN' THEN 'STORAGE_MONTHLY'
  WHEN 'STORAGE_EMBRYO' THEN 'STORAGE_MONTHLY'
  WHEN 'STORAGE_OOCYTE' THEN 'STORAGE_MONTHLY'
  WHEN 'ENGINE_PREMIUM' THEN 'MEMBERSHIP_PREMIUM'
  WHEN 'CLINIC_MEMBERSHIP' THEN 'MEMBERSHIP_BASIC'
  ELSE 'STORAGE_MONTHLY'
END;
DROP TYPE "SubscriptionType";
ALTER TYPE "SubscriptionType_new" RENAME TO "SubscriptionType";
ALTER TABLE "Subscription"
  ALTER COLUMN "type" TYPE "SubscriptionType" USING "type"::"SubscriptionType";

-- SubscriptionStatus replaces SubscriptionState
CREATE TYPE "SubscriptionStatus" AS ENUM (
  'ACTIVE',
  'PAUSED',
  'CANCELLED',
  'EXPIRED',
  'DUNNING'
);

ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "status" "SubscriptionStatus";
UPDATE "Subscription" SET "status" = CASE "state"::text
  WHEN 'ACTIVE' THEN 'ACTIVE'::"SubscriptionStatus"
  WHEN 'PAUSED' THEN 'PAUSED'::"SubscriptionStatus"
  WHEN 'CANCELLED' THEN 'CANCELLED'::"SubscriptionStatus"
  ELSE 'ACTIVE'::"SubscriptionStatus"
END
WHERE "status" IS NULL;
ALTER TABLE "Subscription" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "Subscription" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"SubscriptionStatus";
ALTER TABLE "Subscription" DROP COLUMN IF EXISTS "state";
DROP TYPE IF EXISTS "SubscriptionState";

ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "subscriptionNumber" TEXT;
UPDATE "Subscription"
SET "subscriptionNumber" = 'SUB-' || UPPER(SUBSTRING("id" FROM 1 FOR 8))
WHERE "subscriptionNumber" IS NULL;
ALTER TABLE "Subscription" ALTER COLUMN "subscriptionNumber" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_subscriptionNumber_key" UNIQUE ("subscriptionNumber");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "nextBillingAt" TIMESTAMP(3);
UPDATE "Subscription" SET "nextBillingAt" = "nextBillDate" WHERE "nextBillingAt" IS NULL;
ALTER TABLE "Subscription" ALTER COLUMN "nextBillingAt" SET NOT NULL;
ALTER TABLE "Subscription" DROP COLUMN IF EXISTS "nextBillDate";

ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "gstAmount" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(19,4);
UPDATE "Subscription" SET "totalAmount" = "unitAmount" * "quantity" WHERE "totalAmount" IS NULL;
ALTER TABLE "Subscription" ALTER COLUMN "totalAmount" SET NOT NULL;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "siteId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");
CREATE INDEX IF NOT EXISTS "Subscription_type_idx" ON "Subscription"("type");
CREATE INDEX IF NOT EXISTS "Subscription_subscriberType_subscriberId_idx"
  ON "Subscription"("subscriberType", "subscriberId");
CREATE INDEX IF NOT EXISTS "Subscription_nextBillingAt_idx" ON "Subscription"("nextBillingAt");

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
