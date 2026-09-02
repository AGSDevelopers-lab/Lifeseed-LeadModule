-- Lead Management + Telecaller + Counselling + generic SLA engine
-- Additive only. Existing donors/recipients remain without sourceLeadId.
-- DPDP: unconverted leads purge via retentionExpiresAt (capturedAt + 1 year).

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TELECALLER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'COUNSELLOR';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'OPS_MANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MARKETING_MANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CRM_ADMIN';

CREATE TYPE "LeadPersonType" AS ENUM ('DONOR', 'RECIPIENT');
CREATE TYPE "LeadDonorSubType" AS ENUM ('SEMEN', 'OOCYTE');
CREATE TYPE "LeadSource" AS ENUM (
  'WEB_FORM', 'WHATSAPP_BOT', 'PHONE_INBOUND', 'WALK_IN', 'REFERRAL',
  'SOCIAL_FACEBOOK', 'SOCIAL_INSTAGRAM', 'SOCIAL_GOOGLE_ADS',
  'CLINIC_REFERRAL', 'PARTNER_HOSPITAL', 'OTHER'
);
CREATE TYPE "LeadTier" AS ENUM ('HOT', 'WARM', 'COLD', 'ARCHIVED');
CREATE TYPE "LeadStatus" AS ENUM (
  'NEW', 'ASSIGNED', 'CONTACTED_QUALIFIED', 'CONTACTED_NOT_INTERESTED',
  'CONTACTED_CALLBACK_REQUESTED', 'NOT_REACHABLE', 'WRONG_NUMBER', 'DO_NOT_CALL',
  'COUNSELLING_BOOKED', 'COUNSELLING_ATTENDED', 'COUNSELLING_NO_SHOW',
  'CONVERTED', 'LOST', 'EXPIRED_AUTO_PURGED'
);
CREATE TYPE "CallDispositionType" AS ENUM (
  'CONTACTED_QUALIFIED', 'CONTACTED_NOT_INTERESTED', 'CONTACTED_CALLBACK_REQUESTED',
  'NOT_REACHABLE', 'WRONG_NUMBER', 'DO_NOT_CALL', 'LOST'
);
CREATE TYPE "CounsellingMode" AS ENUM ('IN_PERSON', 'VIDEO_CALL', 'PHONE');
CREATE TYPE "CounsellingBookingStatus" AS ENUM (
  'BOOKED', 'ATTENDED', 'NO_SHOW', 'RESCHEDULED', 'CANCELLED'
);
CREATE TYPE "SlaStatus" AS ENUM (
  'PENDING', 'ACTIVE', 'WARNING_25PCT', 'WARNING_50PCT', 'BREACHED', 'COMPLETED'
);
CREATE TYPE "SlaEntityType" AS ENUM (
  'LEAD_RESPONSE', 'LEAD_QUALIFICATION', 'COUNSELLING_BOOKING',
  'COUNSELLING_REMINDER', 'DONOR_SCREENING', 'DONOR_CONSENT', 'EMBRYOLOGY_OUTCOME'
);
CREATE TYPE "CrmSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'RETRYING', 'SKIPPED');
CREATE TYPE "CrmEntityType" AS ENUM ('LEAD', 'DONOR', 'RECIPIENT');
CREATE TYPE "CrmSyncTarget" AS ENUM ('ZOHO', 'SALESFORCE');
CREATE TYPE "DncSource" AS ENUM ('SELF_REQUEST', 'OPS_ADD', 'COMPLIANCE_ADD');

ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "sourceLeadId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Donor_sourceLeadId_key" ON "Donor"("sourceLeadId");

ALTER TABLE "Recipient" ADD COLUMN IF NOT EXISTS "sourceLeadId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Recipient_sourceLeadId_key" ON "Recipient"("sourceLeadId");

CREATE TABLE IF NOT EXISTS "Lead" (
  "id" TEXT NOT NULL,
  "leadCode" TEXT NOT NULL,
  "personType" "LeadPersonType" NOT NULL,
  "donorSubType" "LeadDonorSubType",
  "source" "LeadSource" NOT NULL,
  "sourceMetadata" JSONB,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fullName" TEXT,
  "phone" TEXT,
  "phoneCountryCode" TEXT NOT NULL DEFAULT '+91',
  "email" TEXT,
  "city" TEXT,
  "state" TEXT,
  "pincode" TEXT,
  "ageGroup" TEXT,
  "preferredLanguage" TEXT,
  "score" INTEGER NOT NULL DEFAULT 0,
  "scoreBreakdown" JSONB,
  "tier" "LeadTier" NOT NULL DEFAULT 'COLD',
  "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
  "assignedTelecallerId" TEXT,
  "assignedAt" TIMESTAMP(3),
  "slaResponseDueAt" TIMESTAMP(3),
  "slaQualifyDueAt" TIMESTAMP(3),
  "convertedDonorId" TEXT,
  "convertedRecipientId" TEXT,
  "convertedAt" TIMESTAMP(3),
  "convertedByUserId" TEXT,
  "lostReason" TEXT,
  "doNotCallFlag" BOOLEAN NOT NULL DEFAULT false,
  "consentMarketing" BOOLEAN NOT NULL DEFAULT false,
  "consentScreening" BOOLEAN NOT NULL DEFAULT false,
  "consentDataProcessing" BOOLEAN NOT NULL DEFAULT false,
  "consentVersion" TEXT,
  "consentIp" TEXT,
  "consentUserAgent" TEXT,
  "retentionExpiresAt" TIMESTAMP(3),
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Lead_leadCode_key" ON "Lead"("leadCode");
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_convertedDonorId_key" ON "Lead"("convertedDonorId");
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_convertedRecipientId_key" ON "Lead"("convertedRecipientId");
CREATE INDEX IF NOT EXISTS "Lead_status_idx" ON "Lead"("status");
CREATE INDEX IF NOT EXISTS "Lead_tier_idx" ON "Lead"("tier");
CREATE INDEX IF NOT EXISTS "Lead_personType_idx" ON "Lead"("personType");
CREATE INDEX IF NOT EXISTS "Lead_assignedTelecallerId_idx" ON "Lead"("assignedTelecallerId");
CREATE INDEX IF NOT EXISTS "Lead_retentionExpiresAt_idx" ON "Lead"("retentionExpiresAt");
CREATE INDEX IF NOT EXISTS "Lead_phone_idx" ON "Lead"("phone");

DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedTelecallerId_fkey"
    FOREIGN KEY ("assignedTelecallerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Donor" ADD CONSTRAINT "Donor_sourceLeadId_fkey"
    FOREIGN KEY ("sourceLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Recipient" ADD CONSTRAINT "Recipient_sourceLeadId_fkey"
    FOREIGN KEY ("sourceLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CallDisposition" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "telecallerId" TEXT NOT NULL,
  "callStartedAt" TIMESTAMP(3) NOT NULL,
  "callEndedAt" TIMESTAMP(3),
  "durationSeconds" INTEGER,
  "disposition" "CallDispositionType" NOT NULL,
  "notes" TEXT,
  "followupAt" TIMESTAMP(3),
  "qaScore" INTEGER,
  "qaSampledByUserId" TEXT,
  "qaSampledAt" TIMESTAMP(3),
  "recordingUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CallDisposition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CallDisposition_leadId_idx" ON "CallDisposition"("leadId");
CREATE INDEX IF NOT EXISTS "CallDisposition_telecallerId_idx" ON "CallDisposition"("telecallerId");
DO $$ BEGIN
  ALTER TABLE "CallDisposition" ADD CONSTRAINT "CallDisposition_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "CallDisposition" ADD CONSTRAINT "CallDisposition_telecallerId_fkey"
    FOREIGN KEY ("telecallerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CounsellingBooking" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "bookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER NOT NULL DEFAULT 30,
  "mode" "CounsellingMode" NOT NULL,
  "counsellorUserId" TEXT NOT NULL,
  "meetingUrl" TEXT,
  "meetingLocation" TEXT,
  "reminderSentAt" TIMESTAMP(3),
  "status" "CounsellingBookingStatus" NOT NULL DEFAULT 'BOOKED',
  "attendedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancelledReason" TEXT,
  "followupNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CounsellingBooking_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CounsellingBooking_leadId_key" ON "CounsellingBooking"("leadId");
CREATE INDEX IF NOT EXISTS "CounsellingBooking_counsellorUserId_scheduledAt_idx"
  ON "CounsellingBooking"("counsellorUserId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "CounsellingBooking_status_idx" ON "CounsellingBooking"("status");
DO $$ BEGIN
  ALTER TABLE "CounsellingBooking" ADD CONSTRAINT "CounsellingBooking_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "CounsellingBooking" ADD CONSTRAINT "CounsellingBooking_counsellorUserId_fkey"
    FOREIGN KEY ("counsellorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SlaSchedule" (
  "id" TEXT NOT NULL,
  "entityType" "SlaEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "stageKey" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "responseWithinHours" INTEGER NOT NULL,
  "completeWithinHours" INTEGER,
  "responseDueAt" TIMESTAMP(3) NOT NULL,
  "completeDueAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "status" "SlaStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastEscalationLevel" INTEGER NOT NULL DEFAULT 0,
  "lastEscalationAt" TIMESTAMP(3),
  "escalationLadder" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SlaSchedule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SlaSchedule_entityType_entityId_stageKey_key"
  ON "SlaSchedule"("entityType", "entityId", "stageKey");
CREATE INDEX IF NOT EXISTS "SlaSchedule_status_responseDueAt_idx" ON "SlaSchedule"("status", "responseDueAt");
CREATE INDEX IF NOT EXISTS "SlaSchedule_entityType_entityId_idx" ON "SlaSchedule"("entityType", "entityId");

CREATE TABLE IF NOT EXISTS "CrmSyncQueue" (
  "id" TEXT NOT NULL,
  "entityType" "CrmEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "syncTarget" "CrmSyncTarget" NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "CrmSyncStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "lastError" TEXT,
  "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "succeededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmSyncQueue_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmSyncQueue_status_scheduledFor_idx" ON "CrmSyncQueue"("status", "scheduledFor");
CREATE INDEX IF NOT EXISTS "CrmSyncQueue_entityType_entityId_idx" ON "CrmSyncQueue"("entityType", "entityId");

CREATE TABLE IF NOT EXISTS "LeadDoNotCallList" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "reason" TEXT NOT NULL,
  "addedByUserId" TEXT,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "source" "DncSource" NOT NULL DEFAULT 'OPS_ADD',
  CONSTRAINT "LeadDoNotCallList_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LeadDoNotCallList_phone_key" ON "LeadDoNotCallList"("phone");
CREATE INDEX IF NOT EXISTS "LeadDoNotCallList_email_idx" ON "LeadDoNotCallList"("email");
DO $$ BEGIN
  ALTER TABLE "LeadDoNotCallList" ADD CONSTRAINT "LeadDoNotCallList_addedByUserId_fkey"
    FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
