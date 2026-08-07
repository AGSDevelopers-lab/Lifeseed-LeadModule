-- Donor Pathway: phases, rejection codes, ELIGIBLE status, deferral fields

CREATE TYPE "DonorPhase" AS ENUM (
  'P0_INTAKE',
  'P1_SCREENING',
  'P2_ACTIVE',
  'P3_DRF',
  'P4_OUTCOME'
);

CREATE TYPE "RejectionCode" AS ENUM (
  'REG_AGE',
  'REG_MAR',
  'REG_CHILD',
  'OPS_KYC',
  'OPS_DUP',
  'OPS_GEO',
  'WDR_VOL',
  'MED_INF',
  'MED_PHY',
  'GEN_HX',
  'SEROLOGY_POSITIVE'
);

ALTER TYPE "DonorStatus" ADD VALUE 'ELIGIBLE';

ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "phase" "DonorPhase" NOT NULL DEFAULT 'P0_INTAKE';
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "deferredUntil" TIMESTAMP(3);
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "outcomeNotes" TEXT;

-- Replace free-text rejectionCode with enum (safe: seed data uses null)
ALTER TABLE "Donor" DROP COLUMN IF EXISTS "rejectionCode";
ALTER TABLE "Donor" ADD COLUMN "rejectionCode" "RejectionCode";

CREATE INDEX IF NOT EXISTS "Donor_phase_idx" ON "Donor"("phase");

-- Align existing ACTIVE passport holders to P2
UPDATE "Donor"
SET phase = 'P2_ACTIVE'
WHERE status = 'ACTIVE' AND "passportIssuedAt" IS NOT NULL;

UPDATE "Donor"
SET phase = 'P1_SCREENING'
WHERE status = 'DEFERRED';
