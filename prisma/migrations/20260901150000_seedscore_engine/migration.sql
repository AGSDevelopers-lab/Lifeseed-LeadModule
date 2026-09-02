-- SeedScore engine: 7-Chakra wellness scoring (additive only).
-- Legacy donors: currentSeedScoreId stays NULL; currentTier defaults UNSCORED.
-- Backfill helper: npx tsx src/scripts/backfill-seedscore-unscored.ts
-- Feature flags (default OFF): SEEDSCORE_GATE_ENABLED, SEEDSCORE_VISIBLE_*, SEEDSCORE_RECALC_ON_SCHEDULE

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BANK_BRM';

CREATE TYPE "ChakraType" AS ENUM (
  'ROOT',
  'SACRAL',
  'SOLAR_PLEXUS',
  'HEART',
  'THROAT',
  'THIRD_EYE',
  'CROWN'
);

CREATE TYPE "SeedScoreTier" AS ENUM (
  'PREMIUM',
  'STANDARD',
  'REGULAR',
  'NOT_RECOMMENDED',
  'UNSCORED'
);

CREATE TYPE "RecalcTrigger" AS ENUM (
  'INTAKE_COMPLETION',
  'LAB_RESULTS',
  'POST_DONATION',
  'SCHEDULED_6M',
  'MANUAL_BRM',
  'DONOR_SELF_UPDATE',
  'RUBRIC_UPDATE'
);

ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "currentSeedScoreId" TEXT;
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "currentTier" "SeedScoreTier" DEFAULT 'UNSCORED';
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "firstScoredAt" TIMESTAMP(3);
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "lastScoredAt" TIMESTAMP(3);
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "scoreRecalcRequired" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "Donor_currentSeedScoreId_key" ON "Donor"("currentSeedScoreId");
CREATE INDEX IF NOT EXISTS "Donor_currentTier_idx" ON "Donor"("currentTier");

CREATE TABLE IF NOT EXISTS "ChakraQuestion" (
  "id" TEXT NOT NULL,
  "chakra" "ChakraType" NOT NULL,
  "donorType" "DonorType" NOT NULL,
  "questionCode" TEXT NOT NULL,
  "questionText" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "subDimension" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT,
  CONSTRAINT "ChakraQuestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChakraQuestion_chakra_donorType_questionCode_key"
  ON "ChakraQuestion"("chakra", "donorType", "questionCode");
CREATE INDEX IF NOT EXISTS "ChakraQuestion_chakra_donorType_isActive_idx"
  ON "ChakraQuestion"("chakra", "donorType", "isActive");

DO $$ BEGIN
  ALTER TABLE "ChakraQuestion" ADD CONSTRAINT "ChakraQuestion_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ChakraRubricOption" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "optionCode" TEXT NOT NULL,
  "optionText" TEXT NOT NULL,
  "scoreValue" INTEGER NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ChakraRubricOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChakraRubricOption_questionId_optionCode_key"
  ON "ChakraRubricOption"("questionId", "optionCode");
CREATE INDEX IF NOT EXISTS "ChakraRubricOption_questionId_idx" ON "ChakraRubricOption"("questionId");

DO $$ BEGIN
  ALTER TABLE "ChakraRubricOption" ADD CONSTRAINT "ChakraRubricOption_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "ChakraQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SeedScore" (
  "id" TEXT NOT NULL,
  "donorId" TEXT NOT NULL,
  "totalScore" INTEGER NOT NULL,
  "tier" "SeedScoreTier" NOT NULL,
  "rootScore" INTEGER NOT NULL,
  "sacralScore" INTEGER NOT NULL,
  "solarPlexusScore" INTEGER NOT NULL,
  "heartScore" INTEGER NOT NULL,
  "throatScore" INTEGER NOT NULL,
  "thirdEyeScore" INTEGER NOT NULL,
  "crownScore" INTEGER NOT NULL,
  "recalcTrigger" "RecalcTrigger" NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "computedByUserId" TEXT,
  "rubricVersion" TEXT NOT NULL,
  CONSTRAINT "SeedScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SeedScore_donorId_key" ON "SeedScore"("donorId");
CREATE INDEX IF NOT EXISTS "SeedScore_tier_idx" ON "SeedScore"("tier");
CREATE INDEX IF NOT EXISTS "SeedScore_computedAt_idx" ON "SeedScore"("computedAt");

DO $$ BEGIN
  ALTER TABLE "SeedScore" ADD CONSTRAINT "SeedScore_donorId_fkey"
    FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Donor" ADD CONSTRAINT "Donor_currentSeedScoreId_fkey"
    FOREIGN KEY ("currentSeedScoreId") REFERENCES "SeedScore"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SeedScoreHistory" (
  "id" TEXT NOT NULL,
  "donorId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "totalScore" INTEGER NOT NULL,
  "tier" "SeedScoreTier" NOT NULL,
  "rootScore" INTEGER NOT NULL,
  "sacralScore" INTEGER NOT NULL,
  "solarPlexusScore" INTEGER NOT NULL,
  "heartScore" INTEGER NOT NULL,
  "throatScore" INTEGER NOT NULL,
  "thirdEyeScore" INTEGER NOT NULL,
  "crownScore" INTEGER NOT NULL,
  "recalcTrigger" "RecalcTrigger" NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL,
  "computedByUserId" TEXT,
  "rubricVersion" TEXT NOT NULL,
  "supersededAt" TIMESTAMP(3),
  "supersededByScoreId" TEXT,
  CONSTRAINT "SeedScoreHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SeedScoreHistory_donorId_versionNumber_key"
  ON "SeedScoreHistory"("donorId", "versionNumber");
CREATE INDEX IF NOT EXISTS "SeedScoreHistory_donorId_computedAt_idx"
  ON "SeedScoreHistory"("donorId", "computedAt");

DO $$ BEGIN
  ALTER TABLE "SeedScoreHistory" ADD CONSTRAINT "SeedScoreHistory_donorId_fkey"
    FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SeedScoreAnswer" (
  "id" TEXT NOT NULL,
  "seedScoreId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "selectedOptionId" TEXT NOT NULL,
  "notes" TEXT,
  "answeredByUserId" TEXT,
  CONSTRAINT "SeedScoreAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SeedScoreAnswer_seedScoreId_questionId_key"
  ON "SeedScoreAnswer"("seedScoreId", "questionId");
CREATE INDEX IF NOT EXISTS "SeedScoreAnswer_seedScoreId_idx" ON "SeedScoreAnswer"("seedScoreId");

DO $$ BEGIN
  ALTER TABLE "SeedScoreAnswer" ADD CONSTRAINT "SeedScoreAnswer_seedScoreId_fkey"
    FOREIGN KEY ("seedScoreId") REFERENCES "SeedScore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SeedScoreAnswer" ADD CONSTRAINT "SeedScoreAnswer_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "ChakraQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SeedScoreAnswer" ADD CONSTRAINT "SeedScoreAnswer_selectedOptionId_fkey"
    FOREIGN KEY ("selectedOptionId") REFERENCES "ChakraRubricOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RubricVersion" (
  "id" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedByUserId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  CONSTRAINT "RubricVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RubricVersion_versionNumber_key" ON "RubricVersion"("versionNumber");
CREATE INDEX IF NOT EXISTS "RubricVersion_isActive_idx" ON "RubricVersion"("isActive");

DO $$ BEGIN
  ALTER TABLE "RubricVersion" ADD CONSTRAINT "RubricVersion_publishedByUserId_fkey"
    FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
