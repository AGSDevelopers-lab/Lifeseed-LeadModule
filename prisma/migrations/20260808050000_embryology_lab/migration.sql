-- Embryology Lab: CycleEvent, OutcomeNudge, cohort/embryo enhancements, roles

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CLINIC_EMBRYOLOGIST';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CLINIC_WITNESS';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BANK_MEDICAL_DIRECTOR';

CREATE TYPE "CycleEventType" AS ENUM (
  'STIM_MONITORING',
  'OPU_COMPLETED',
  'OOCYTES_RETRIEVED',
  'FERTILIZATION',
  'DAY1_CHECK',
  'DAY3_GRADE',
  'DAY5_GRADE',
  'PGT_RESULT',
  'TRANSFER',
  'VITRIFICATION',
  'BETA_HCG',
  'CLINICAL_PREGNANCY',
  'LIVE_BIRTH',
  'CYCLE_CANCELLED'
);

CREATE TYPE "CycleOutcome" AS ENUM (
  'PREGNANT',
  'NOT_PREGNANT',
  'CANCELLED',
  'CLOSED_NO_OUTCOME'
);

CREATE TYPE "BetaHcgResult" AS ENUM (
  'POSITIVE',
  'NEGATIVE',
  'INCONCLUSIVE'
);

CREATE TYPE "PgtResult" AS ENUM (
  'EUPLOID',
  'ANEUPLOID',
  'MOSAIC',
  'NO_RESULT'
);

CREATE TYPE "CycleLocation" AS ENUM ('BANK', 'L1', 'L2');

CREATE TYPE "NudgeStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED');

ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "embryologyConfig" JSONB;

-- EmbryoCohort enhancements
ALTER TABLE "EmbryoCohort" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "EmbryoCohort" ADD COLUMN IF NOT EXISTS "oocytesRetrieved" INTEGER;
UPDATE "EmbryoCohort" SET "oocytesRetrieved" = "totalOocytesRetrieved" WHERE "oocytesRetrieved" IS NULL;
ALTER TABLE "EmbryoCohort" ADD COLUMN IF NOT EXISTS "miCount" INTEGER;
ALTER TABLE "EmbryoCohort" ADD COLUMN IF NOT EXISTS "gvCount" INTEGER;
ALTER TABLE "EmbryoCohort" ADD COLUMN IF NOT EXISTS "day1_2pnCount" INTEGER;
ALTER TABLE "EmbryoCohort" ADD COLUMN IF NOT EXISTS "day3CleavedCount" INTEGER;
ALTER TABLE "EmbryoCohort" ADD COLUMN IF NOT EXISTS "day5BlastCount" INTEGER;
ALTER TABLE "EmbryoCohort" ADD COLUMN IF NOT EXISTS "transferredCount" INTEGER DEFAULT 0;
ALTER TABLE "EmbryoCohort" ADD COLUMN IF NOT EXISTS "vitrifiedCount" INTEGER DEFAULT 0;
ALTER TABLE "EmbryoCohort" ADD COLUMN IF NOT EXISTS "discardedCount" INTEGER DEFAULT 0;
ALTER TABLE "EmbryoCohort" ADD COLUMN IF NOT EXISTS "outcome" "CycleOutcome";
ALTER TABLE "EmbryoCohort" ADD COLUMN IF NOT EXISTS "outcomeReportedAt" TIMESTAMP(3);
ALTER TABLE "EmbryoCohort" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
ALTER TABLE "EmbryoCohort" ADD COLUMN IF NOT EXISTS "currentPhase" TEXT NOT NULL DEFAULT 'E0';
ALTER TABLE "EmbryoCohort" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Embryo enhancements
ALTER TABLE "Embryo" ADD COLUMN IF NOT EXISTS "oocyteRef" TEXT;
ALTER TABLE "Embryo" ADD COLUMN IF NOT EXISTS "storageRef" TEXT;
ALTER TABLE "Embryo" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Embryo" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Migrate pgtResult String → PgtResult enum
ALTER TABLE "Embryo" ADD COLUMN IF NOT EXISTS "pgtResult_new" "PgtResult";
UPDATE "Embryo" SET "pgtResult_new" = CASE UPPER(COALESCE("pgtResult", ''))
  WHEN 'EUPLOID' THEN 'EUPLOID'::"PgtResult"
  WHEN 'ANEUPLOID' THEN 'ANEUPLOID'::"PgtResult"
  WHEN 'MOSAIC' THEN 'MOSAIC'::"PgtResult"
  WHEN 'NO_RESULT' THEN 'NO_RESULT'::"PgtResult"
  ELSE NULL
END;
ALTER TABLE "Embryo" DROP COLUMN IF EXISTS "pgtResult";
ALTER TABLE "Embryo" RENAME COLUMN "pgtResult_new" TO "pgtResult";

CREATE INDEX IF NOT EXISTS "Embryo_cohortId_idx" ON "Embryo"("cohortId");
CREATE INDEX IF NOT EXISTS "Embryo_disposition_idx" ON "Embryo"("disposition");

CREATE TABLE IF NOT EXISTS "CycleEvent" (
  "id" TEXT NOT NULL,
  "drfId" TEXT NOT NULL,
  "eventType" "CycleEventType" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL,
  "actorUserId" TEXT,
  "clinicId" TEXT NOT NULL,
  "location" "CycleLocation" NOT NULL DEFAULT 'L2',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CycleEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CycleEvent_drfId_occurredAt_idx" ON "CycleEvent"("drfId", "occurredAt");
CREATE INDEX IF NOT EXISTS "CycleEvent_clinicId_idx" ON "CycleEvent"("clinicId");
CREATE INDEX IF NOT EXISTS "CycleEvent_eventType_idx" ON "CycleEvent"("eventType");

DO $$ BEGIN
  ALTER TABLE "CycleEvent" ADD CONSTRAINT "CycleEvent_drfId_fkey"
    FOREIGN KEY ("drfId") REFERENCES "DRF"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CycleEvent" ADD CONSTRAINT "CycleEvent_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "OutcomeNudge" (
  "id" TEXT NOT NULL,
  "drfId" TEXT NOT NULL,
  "dayOffset" INTEGER NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "status" "NudgeStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutcomeNudge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OutcomeNudge_drfId_dayOffset_key" ON "OutcomeNudge"("drfId", "dayOffset");
CREATE INDEX IF NOT EXISTS "OutcomeNudge_status_scheduledAt_idx" ON "OutcomeNudge"("status", "scheduledAt");

DO $$ BEGIN
  ALTER TABLE "OutcomeNudge" ADD CONSTRAINT "OutcomeNudge_drfId_fkey"
    FOREIGN KEY ("drfId") REFERENCES "DRF"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
