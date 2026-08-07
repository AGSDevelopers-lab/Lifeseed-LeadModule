-- Dispatch & Fulfillment: DRF 10-state, DispatchOrderState, new DispatchType,
-- ChallanStatus, InvoiceStatus, BANK_LOGISTICS

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BANK_LOGISTICS';

-- ── DrfState remap ──────────────────────────────────────────────────────────
CREATE TYPE "DrfState_new" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'ACCEPTED',
  'ALLOCATED',
  'IN_TRANSIT',
  'DELIVERED',
  'IN_CYCLE',
  'OUTCOME_PENDING',
  'CLOSED',
  'CANCELLED'
);

ALTER TABLE "DRF" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "DRF" ALTER COLUMN "state" TYPE TEXT USING "state"::text;

UPDATE "DRF" SET "state" = CASE "state"
  WHEN 'REJECTED' THEN 'CANCELLED'
  WHEN 'MATCHING' THEN 'ACCEPTED'
  WHEN 'MATCH_READY' THEN 'ACCEPTED'
  WHEN 'AWAITING_RECIPIENT_SELECTION' THEN 'ACCEPTED'
  WHEN 'DISPATCHED' THEN 'IN_TRANSIT'
  WHEN 'CLOSED_OUTCOME' THEN 'CLOSED'
  WHEN 'CLOSED_NO_OUTCOME' THEN 'CLOSED'
  ELSE "state"
END;

DROP TYPE "DrfState";
ALTER TYPE "DrfState_new" RENAME TO "DrfState";

ALTER TABLE "DRF"
  ALTER COLUMN "state" TYPE "DrfState" USING "state"::"DrfState";
ALTER TABLE "DRF" ALTER COLUMN "state" SET DEFAULT 'DRAFT'::"DrfState";

-- ── DispatchType remap ──────────────────────────────────────────────────────
CREATE TYPE "DispatchType_new" AS ENUM (
  'SEMEN_VIAL',
  'OOCYTE_FRESH',
  'OOCYTE_VITRIFIED',
  'EMBRYO_FRESH',
  'EMBRYO_VITRIFIED',
  'ANCILLARY_SUPPLIES'
);

ALTER TABLE "DispatchOrder" ALTER COLUMN "type" TYPE TEXT USING "type"::text;
UPDATE "DispatchOrder" SET "type" = CASE "type"
  WHEN 'SEMEN_TAGGED' THEN 'SEMEN_VIAL'
  WHEN 'SEMEN_UNTAGGED' THEN 'SEMEN_VIAL'
  WHEN 'SEMEN_RETURN' THEN 'SEMEN_VIAL'
  WHEN 'OOCYTE_DONOR_UNSTIM' THEN 'OOCYTE_FRESH'
  WHEN 'OOCYTE_DONOR_STIM' THEN 'OOCYTE_FRESH'
  WHEN 'OOCYTE_DONOR_RETURN' THEN 'OOCYTE_FRESH'
  ELSE 'SEMEN_VIAL'
END;

DROP TYPE "DispatchType";
ALTER TYPE "DispatchType_new" RENAME TO "DispatchType";

ALTER TABLE "DispatchOrder"
  ALTER COLUMN "type" TYPE "DispatchType" USING "type"::"DispatchType";

-- ── DispatchOrderState (replaces DispatchState) ─────────────────────────────
CREATE TYPE "DispatchOrderState" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'ACCEPTED',
  'ALLOCATED',
  'IN_TRANSIT',
  'DELIVERED',
  'IN_CYCLE',
  'OUTCOME_PENDING',
  'CLOSED',
  'CANCELLED'
);

ALTER TABLE "DispatchOrder" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "DispatchOrder" ALTER COLUMN "state" TYPE TEXT USING "state"::text;
UPDATE "DispatchOrder" SET "state" = CASE "state"
  WHEN 'BOOKED' THEN 'SUBMITTED'
  WHEN 'PICKED' THEN 'ACCEPTED'
  WHEN 'PACKED' THEN 'ALLOCATED'
  WHEN 'IN_TRANSIT' THEN 'IN_TRANSIT'
  WHEN 'DELIVERED' THEN 'DELIVERED'
  WHEN 'RECEIVED' THEN 'IN_CYCLE'
  WHEN 'TAGGED' THEN 'IN_CYCLE'
  WHEN 'USED' THEN 'OUTCOME_PENDING'
  WHEN 'CLOSED' THEN 'CLOSED'
  WHEN 'CANCELLED' THEN 'CANCELLED'
  WHEN 'EXCEPTION' THEN 'CANCELLED'
  WHEN 'RETURNING' THEN 'IN_TRANSIT'
  WHEN 'DRAFT' THEN 'DRAFT'
  ELSE 'DRAFT'
END;

DROP TYPE "DispatchState";
ALTER TABLE "DispatchOrder"
  ALTER COLUMN "state" TYPE "DispatchOrderState" USING "state"::"DispatchOrderState";
ALTER TABLE "DispatchOrder" ALTER COLUMN "state" SET DEFAULT 'DRAFT'::"DispatchOrderState";

-- ── ChallanStatus (replaces DocumentState on Challan) ───────────────────────
CREATE TYPE "ChallanStatus" AS ENUM (
  'RAISED',
  'ACKNOWLEDGED',
  'CONVERTED_TO_INVOICE',
  'CANCELLED'
);

ALTER TABLE "Challan" ADD COLUMN IF NOT EXISTS "status" "ChallanStatus";
UPDATE "Challan" SET "status" = CASE "state"::text
  WHEN 'DRAFT' THEN 'RAISED'::"ChallanStatus"
  WHEN 'ISSUED' THEN 'RAISED'::"ChallanStatus"
  WHEN 'CANCELLED' THEN 'CANCELLED'::"ChallanStatus"
  WHEN 'CONVERTED_TO_INVOICE' THEN 'CONVERTED_TO_INVOICE'::"ChallanStatus"
  ELSE 'RAISED'::"ChallanStatus"
END
WHERE "status" IS NULL;
ALTER TABLE "Challan" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "Challan" ALTER COLUMN "status" SET DEFAULT 'RAISED'::"ChallanStatus";
ALTER TABLE "Challan" DROP COLUMN IF EXISTS "state";
DROP TYPE IF EXISTS "DocumentState";

ALTER TABLE "Challan" ALTER COLUMN "dispatchId" DROP NOT NULL;
ALTER TABLE "Challan" ADD COLUMN IF NOT EXISTS "drfId" TEXT;
CREATE INDEX IF NOT EXISTS "Challan_status_idx" ON "Challan"("status");
CREATE INDEX IF NOT EXISTS "Challan_drfId_idx" ON "Challan"("drfId");

DO $$ BEGIN
  ALTER TABLE "Challan" ADD CONSTRAINT "Challan_drfId_fkey"
    FOREIGN KEY ("drfId") REFERENCES "DRF"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── InvoiceStatus (replaces InvoiceState) ───────────────────────────────────
CREATE TYPE "InvoiceStatus" AS ENUM (
  'DRAFT',
  'RAISED',
  'PAID_FULL',
  'PAID_PARTIAL',
  'OVERDUE',
  'CREDITED',
  'VOID'
);

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "status" "InvoiceStatus";
UPDATE "Invoice" SET "status" = CASE "state"::text
  WHEN 'DRAFT' THEN 'DRAFT'::"InvoiceStatus"
  WHEN 'ISSUED' THEN 'RAISED'::"InvoiceStatus"
  WHEN 'PARTIALLY_PAID' THEN 'PAID_PARTIAL'::"InvoiceStatus"
  WHEN 'PAID' THEN 'PAID_FULL'::"InvoiceStatus"
  WHEN 'OVERDUE' THEN 'OVERDUE'::"InvoiceStatus"
  WHEN 'WRITTEN_OFF' THEN 'VOID'::"InvoiceStatus"
  WHEN 'CANCELLED' THEN 'VOID'::"InvoiceStatus"
  ELSE 'RAISED'::"InvoiceStatus"
END
WHERE "status" IS NULL;
ALTER TABLE "Invoice" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'RAISED'::"InvoiceStatus";
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "state";
DROP TYPE IF EXISTS "InvoiceState";

DROP INDEX IF EXISTS "Invoice_state_idx";
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");

-- ── DRF new columns ─────────────────────────────────────────────────────────
ALTER TABLE "DRF" ALTER COLUMN "recipientId" DROP NOT NULL;

ALTER TABLE "DRF" ADD COLUMN IF NOT EXISTS "type" "DispatchType" NOT NULL DEFAULT 'SEMEN_VIAL';
ALTER TABLE "DRF" ADD COLUMN IF NOT EXISTS "priority" "SamplePriority" NOT NULL DEFAULT 'REGULAR';
ALTER TABLE "DRF" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "DRF" ADD COLUMN IF NOT EXISTS "requestedQuantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "DRF" ADD COLUMN IF NOT EXISTS "filterCategory" "SampleCategory";
ALTER TABLE "DRF" ADD COLUMN IF NOT EXISTS "filterGrade" "SampleGrade";
ALTER TABLE "DRF" ADD COLUMN IF NOT EXISTS "assignedVialIds" JSONB;
ALTER TABLE "DRF" ADD COLUMN IF NOT EXISTS "dispatchedAt" TIMESTAMP(3);
ALTER TABLE "DRF" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
ALTER TABLE "DRF" ADD COLUMN IF NOT EXISTS "expectedDeliveryAt" TIMESTAMP(3);

ALTER TABLE "DRF" ALTER COLUMN "financialModelApplied" SET DEFAULT 'B'::"FinancialModel";
ALTER TABLE "DRF" ALTER COLUMN "donorType" SET DEFAULT 'SEMEN'::"DonorType";

CREATE INDEX IF NOT EXISTS "DRF_type_priority_idx" ON "DRF"("type", "priority");

-- ── DispatchOrder new columns ───────────────────────────────────────────────
ALTER TABLE "DispatchOrder" ADD COLUMN IF NOT EXISTS "priority" "SamplePriority" NOT NULL DEFAULT 'REGULAR';
ALTER TABLE "DispatchOrder" ADD COLUMN IF NOT EXISTS "chainOfCustodyLog" JSONB;
ALTER TABLE "DispatchOrder" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "DispatchOrder_clinicId_idx" ON "DispatchOrder"("clinicId");
