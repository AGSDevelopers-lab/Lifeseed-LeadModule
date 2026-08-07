-- Andrology Lab: SampleState 12-state machine, releaseTiming, QC/category configs

-- New enum values / types
CREATE TYPE "SampleReleaseTiming" AS ENUM ('REGULAR', 'QUARANTINE');

CREATE TYPE "SampleState_new" AS ENUM (
  'DRAFT',
  'ACCESSIONED',
  'ANALYZED',
  'ADVANCED_TESTING',
  'DECIDED',
  'PREPARED',
  'VIALED',
  'CRYOPRESERVED',
  'QC_A5_PENDING',
  'QUARANTINE',
  'POST_THAW_ANALYZED',
  'CLOSED'
);

ALTER TABLE "Sample" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "Sample" ALTER COLUMN "state" TYPE TEXT USING "state"::text;

UPDATE "Sample" SET "state" = CASE "state"
  WHEN 'PREP_DONE' THEN 'PREPARED'
  WHEN 'VIAL_CREATED' THEN 'VIALED'
  WHEN 'CRYO_DONE' THEN 'CRYOPRESERVED'
  WHEN 'QC_A5_PASS' THEN 'POST_THAW_ANALYZED'
  WHEN 'QC_A5_FAIL' THEN 'CLOSED'
  WHEN 'IN_QUARANTINE' THEN 'QUARANTINE'
  WHEN 'QUARANTINE_CLEARED' THEN 'POST_THAW_ANALYZED'
  WHEN 'IN_INVENTORY' THEN 'CLOSED'
  WHEN 'DISCARDED' THEN 'CLOSED'
  ELSE "state"
END;

DROP TYPE "SampleState";
ALTER TYPE "SampleState_new" RENAME TO "SampleState";

ALTER TABLE "Sample"
  ALTER COLUMN "state" TYPE "SampleState" USING "state"::"SampleState";
ALTER TABLE "Sample" ALTER COLUMN "state" SET DEFAULT 'DRAFT'::"SampleState";

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BANK_QC_OFFICER';

ALTER TABLE "Sample" ADD COLUMN IF NOT EXISTS "releaseTiming" "SampleReleaseTiming" NOT NULL DEFAULT 'QUARANTINE';
ALTER TABLE "Sample" ADD COLUMN IF NOT EXISTS "deliveredToLabAt" TIMESTAMP(3);
ALTER TABLE "Sample" ADD COLUMN IF NOT EXISTS "qcA1ContainerIntact" BOOLEAN;
ALTER TABLE "Sample" ADD COLUMN IF NOT EXISTS "qcA1IdMatch" BOOLEAN;
ALTER TABLE "Sample" ADD COLUMN IF NOT EXISTS "qcA1TimeUnder30" BOOLEAN;
ALTER TABLE "Sample" ADD COLUMN IF NOT EXISTS "qcA1CompleteEjaculate" BOOLEAN;
ALTER TABLE "Sample" ADD COLUMN IF NOT EXISTS "decisionOutcome" TEXT;
ALTER TABLE "Sample" ADD COLUMN IF NOT EXISTS "testVialThawResult" DOUBLE PRECISION;
ALTER TABLE "Sample" ADD COLUMN IF NOT EXISTS "postThawConcentration" DOUBLE PRECISION;
ALTER TABLE "Sample" ADD COLUMN IF NOT EXISTS "postThawRapidPRPct" DOUBLE PRECISION;
ALTER TABLE "Sample" ADD COLUMN IF NOT EXISTS "postThawSlowPRPct" DOUBLE PRECISION;
ALTER TABLE "Sample" ADD COLUMN IF NOT EXISTS "postThawNonProgPct" DOUBLE PRECISION;
ALTER TABLE "Sample" ADD COLUMN IF NOT EXISTS "postThawVitalityPct" DOUBLE PRECISION;
ALTER TABLE "Sample" ADD COLUMN IF NOT EXISTS "postThawMorphologyPct" DOUBLE PRECISION;
ALTER TABLE "Sample" ADD COLUMN IF NOT EXISTS "postThawVolumeML" DOUBLE PRECISION;
ALTER TABLE "Sample" ADD COLUMN IF NOT EXISTS "day165NotifiedAt" TIMESTAMP(3);

-- Sync releaseTiming from legacy sampleType where possible
UPDATE "Sample" SET "releaseTiming" = CASE
  WHEN "sampleType" = 'REGULAR' THEN 'REGULAR'::"SampleReleaseTiming"
  ELSE 'QUARANTINE'::"SampleReleaseTiming"
END;

CREATE INDEX IF NOT EXISTS "Sample_releaseTiming_priority_idx" ON "Sample"("releaseTiming", "priority");

ALTER TABLE "Vial" ADD COLUMN IF NOT EXISTS "category" "SampleCategory";
ALTER TABLE "Vial" ADD COLUMN IF NOT EXISTS "grade" "SampleGrade";
ALTER TABLE "Vial" ADD COLUMN IF NOT EXISTS "isQuarantined" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Vial_isQuarantined_idx" ON "Vial"("isQuarantined");

CREATE TABLE IF NOT EXISTS "QcGateConfig" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "gateName" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "thresholdOverrides" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QcGateConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "QcGateConfig_siteId_gateName_key" ON "QcGateConfig"("siteId", "gateName");
CREATE INDEX IF NOT EXISTS "QcGateConfig_siteId_idx" ON "QcGateConfig"("siteId");

ALTER TABLE "QcGateConfig" DROP CONSTRAINT IF EXISTS "QcGateConfig_siteId_fkey";
ALTER TABLE "QcGateConfig"
  ADD CONSTRAINT "QcGateConfig_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CategoryRuleConfig" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "rulesJson" JSONB NOT NULL,
  "tankMappingJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CategoryRuleConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CategoryRuleConfig_siteId_key" ON "CategoryRuleConfig"("siteId");

ALTER TABLE "CategoryRuleConfig" DROP CONSTRAINT IF EXISTS "CategoryRuleConfig_siteId_fkey";
ALTER TABLE "CategoryRuleConfig"
  ADD CONSTRAINT "CategoryRuleConfig_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
