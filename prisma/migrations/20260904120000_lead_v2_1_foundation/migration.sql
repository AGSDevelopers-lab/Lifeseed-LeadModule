-- Lead v2.1 B01 Foundation — additive only. No drops, no renames.

-- Existing enum extensions
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'HOSPITAL_REFERRAL';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'PARTNER';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'CAMPAIGN';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'API';
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'MANUAL';

ALTER TYPE "CrmSyncStatus" ADD VALUE IF NOT EXISTS 'DEAD';

ALTER TYPE "DncSource" ADD VALUE IF NOT EXISTS 'LEAD_REQUEST';
ALTER TYPE "DncSource" ADD VALUE IF NOT EXISTS 'REGULATOR';
ALTER TYPE "DncSource" ADD VALUE IF NOT EXISTS 'SYSTEM';
ALTER TYPE "DncSource" ADD VALUE IF NOT EXISTS 'UNSUBSCRIBE_LINK';
ALTER TYPE "DncSource" ADD VALUE IF NOT EXISTS 'MANUAL';

-- New enums
DO $$ BEGIN
  CREATE TYPE "LeadLanguage" AS ENUM ('ENGLISH', 'HINDI', 'BENGALI', 'TELUGU', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "LeadOutcome" AS ENUM ('WON', 'LOST', 'EXPIRED', 'MERGED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "LeadActivityType" AS ENUM ('CALL', 'WHATSAPP', 'SMS', 'EMAIL', 'NOTE', 'FOLLOW_UP', 'COUNSELLING', 'APPOINTMENT', 'STATUS_CHANGE', 'ASSIGNMENT', 'ESCALATION', 'CONVERSION', 'MERGE', 'DNC', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "LeadChannel" AS ENUM ('INBOUND', 'OUTBOUND', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "LeadEvent" AS ENUM ('intake', 'assign', 'reassign', 'claim', 'disposition_qualified', 'disposition_not_interested', 'disposition_callback', 'disposition_not_reachable', 'disposition_wrong_number', 'disposition_do_not_call', 'book_counselling', 'session_attended', 'session_no_show', 'session_cancelled', 'convert_donor', 'convert_recipient', 'archive', 'unarchive', 'reactivate', 'expire_by_retention', 'merge_loser');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "AssignmentType" AS ENUM ('AUTO_ROUND_ROBIN', 'MANUAL', 'REASSIGN', 'CLAIM', 'ESCALATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "FollowUpType" AS ENUM ('CALLBACK', 'RECONTACT', 'COUNSELLING_REMINDER', 'DOC_REQUEST', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "FollowUpPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "FollowUpStatus" AS ENUM ('OPEN', 'DUE', 'OVERDUE', 'COMPLETED', 'CANCELLED', 'RESCHEDULED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "BookingStatus" AS ENUM ('SCHEDULED', 'RESCHEDULED', 'CANCELLED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "SessionAttendance" AS ENUM ('ATTENDED', 'NO_SHOW', 'CANCELLED_BY_CLINIC', 'CANCELLED_BY_LEAD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "CounsellingRecommendation" AS ENUM ('RECOMMEND_REGISTER', 'DEFER', 'DECLINE', 'REFER_OUT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "TouchType" AS ENUM ('FIRST', 'SUBSEQUENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "MatchLevel" AS ENUM ('EXACT', 'PROBABLE', 'POSSIBLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "DupReviewStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'MERGED', 'KEPT_SEPARATE', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "MergeCopyStrategy" AS ENUM ('COPY_ALL', 'COPY_MEANINGFUL', 'REFERENCE_ONLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "DncChannel" AS ENUM ('PHONE', 'EMAIL', 'WHATSAPP', 'SMS', 'ALL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "ConversionTarget" AS ENUM ('DONOR', 'RECIPIENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "LeadEventType" AS ENUM ('LeadCreated', 'LeadAssigned', 'LeadContacted', 'LeadQualified', 'LeadFollowUpCreated', 'LeadFollowUpCompleted', 'CounsellingBooked', 'CounsellingAttended', 'CounsellingNoShow', 'LeadLost', 'LeadConverted', 'LeadMerged', 'LeadDncAdded', 'LeadScoreChanged', 'LeadArchived', 'LeadReactivated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "DispatchStatus" AS ENUM ('PENDING', 'IN_FLIGHT', 'PUBLISHED', 'FAILED', 'DEAD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "DlqResolution" AS ENUM ('REPUBLISH', 'DISCARD', 'MANUAL_FIX');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'IN_APP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "NotificationProvider" AS ENUM ('RESEND', 'SMS_MAGIC', 'META_WHATSAPP', 'IN_APP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'READ', 'REPLIED', 'BLOCKED_DNC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "CrmOperation" AS ENUM ('UPSERT_LEAD', 'UPDATE_STATUS', 'LOG_ACTIVITY', 'CLOSE_LEAD', 'CONVERT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "ScoreTrigger" AS ENUM ('intake', 'manual_rescore', 'config_version_change', 'activity_signal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Additive Lead columns (FKs added after new tables exist)
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "outcome" "LeadOutcome";
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "archivedByUserId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "archiveReason" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "latestScoreId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "latestScoreValue" INTEGER;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "activeAssignmentId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "mergedIntoLeadId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "duplicateOfLeadId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "redactedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "redactionReason" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS "Lead_latestScoreId_key" ON "Lead"("latestScoreId");
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_activeAssignmentId_key" ON "Lead"("activeAssignmentId");
CREATE INDEX IF NOT EXISTS "Lead_email_idx" ON "Lead"("email");
CREATE INDEX IF NOT EXISTS "Lead_isArchived_idx" ON "Lead"("isArchived");
CREATE INDEX IF NOT EXISTS "Lead_campaignId_capturedAt_idx" ON "Lead"("campaignId", "capturedAt");
CREATE INDEX IF NOT EXISTS "Lead_assignedTelecallerId_status_idx" ON "Lead"("assignedTelecallerId", "status");
CREATE INDEX IF NOT EXISTS "Lead_mergedIntoLeadId_idx" ON "Lead"("mergedIntoLeadId");

ALTER TABLE "CallDisposition" ADD COLUMN IF NOT EXISTS "activityId" TEXT;
ALTER TABLE "CallDisposition" ADD COLUMN IF NOT EXISTS "followUpId" TEXT;

ALTER TABLE "CounsellingBooking" ADD COLUMN IF NOT EXISTS "bookingStatus" "BookingStatus" NOT NULL DEFAULT 'SCHEDULED';
ALTER TABLE "CounsellingBooking" ADD COLUMN IF NOT EXISTS "rescheduledFromBookingId" TEXT;
ALTER TABLE "CounsellingBooking" ADD COLUMN IF NOT EXISTS "cancelledByUserId" TEXT;
CREATE INDEX IF NOT EXISTS "CounsellingBooking_bookingStatus_idx" ON "CounsellingBooking"("bookingStatus");

ALTER TABLE "CrmSyncQueue" ADD COLUMN IF NOT EXISTS "outboxEventId" TEXT;
ALTER TABLE "CrmSyncQueue" ADD COLUMN IF NOT EXISTS "operation" "CrmOperation";
ALTER TABLE "CrmSyncQueue" ADD COLUMN IF NOT EXISTS "payloadVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CrmSyncQueue" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "CrmSyncQueue" ADD COLUMN IF NOT EXISTS "lastAttemptError" TEXT;

CREATE TABLE IF NOT EXISTS "Campaign" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "source" "LeadSource" NOT NULL,
  "medium" TEXT,
  "channel" TEXT,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3),
  "budgetInr" DECIMAL(12,2),
  "actualSpendInr" DECIMAL(12,2),
  "ownerUserId" TEXT NOT NULL,
  "creativeRefs" JSONB,
  "landingPageUrls" JSONB,
  "referralPartnerId" TEXT,
  "utmDefaults" JSONB,
  "status" "CampaignStatus" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Campaign_code_key" ON "Campaign"("code");
CREATE INDEX IF NOT EXISTS "Campaign_status_startAt_endAt_idx" ON "Campaign"("status", "startAt", "endAt");

CREATE TABLE IF NOT EXISTS "LeadOutboxEvent" (
  "id" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "eventType" "LeadEventType" NOT NULL,
  "eventVersion" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "enqueuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "dispatchStatus" "DispatchStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "lastAttemptError" TEXT,
  "lockedUntil" TIMESTAMP(3),
  "lockedByWorkerId" TEXT,
  CONSTRAINT "LeadOutboxEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LeadOutboxEvent_dispatchStatus_enqueuedAt_idx" ON "LeadOutboxEvent"("dispatchStatus", "enqueuedAt");
CREATE INDEX IF NOT EXISTS "LeadOutboxEvent_aggregateId_occurredAt_idx" ON "LeadOutboxEvent"("aggregateId", "occurredAt");

CREATE TABLE IF NOT EXISTS "LeadActivity" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "activityType" "LeadActivityType" NOT NULL,
  "channel" "LeadChannel",
  "actorUserId" TEXT,
  "actorRole" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "summary" TEXT,
  "outcome" TEXT,
  "nextAction" TEXT,
  "nextActionDueAt" TIMESTAMP(3),
  "metadata" JSONB,
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,
  "auditRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LeadActivity_leadId_occurredAt_idx" ON "LeadActivity"("leadId", "occurredAt");
CREATE INDEX IF NOT EXISTS "LeadActivity_actorUserId_occurredAt_idx" ON "LeadActivity"("actorUserId", "occurredAt");
CREATE INDEX IF NOT EXISTS "LeadActivity_activityType_idx" ON "LeadActivity"("activityType");

CREATE TABLE IF NOT EXISTS "LeadStatusHistory" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "fromStatus" "LeadStatus",
  "toStatus" "LeadStatus" NOT NULL,
  "event" "LeadEvent" NOT NULL,
  "guardsPassed" JSONB,
  "actorUserId" TEXT,
  "actorRole" TEXT,
  "reason" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "outboxEventId" TEXT,
  "auditRef" TEXT,
  CONSTRAINT "LeadStatusHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LeadStatusHistory_leadId_occurredAt_idx" ON "LeadStatusHistory"("leadId", "occurredAt");
CREATE INDEX IF NOT EXISTS "LeadStatusHistory_actorUserId_idx" ON "LeadStatusHistory"("actorUserId");
CREATE INDEX IF NOT EXISTS "LeadStatusHistory_toStatus_occurredAt_idx" ON "LeadStatusHistory"("toStatus", "occurredAt");

CREATE TABLE IF NOT EXISTS "LeadScore" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "tier" "LeadTier" NOT NULL,
  "breakdown" JSONB NOT NULL,
  "configKey" TEXT NOT NULL,
  "configVersion" INTEGER NOT NULL,
  "triggerReason" "ScoreTrigger" NOT NULL,
  "computedByUserId" TEXT,
  "computedAt" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  CONSTRAINT "LeadScore_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LeadScore_leadId_computedAt_idx" ON "LeadScore"("leadId", "computedAt");
CREATE INDEX IF NOT EXISTS "LeadScore_configKey_configVersion_idx" ON "LeadScore"("configKey", "configVersion");

CREATE TABLE IF NOT EXISTS "LeadAssignment" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "assigneeUserId" TEXT NOT NULL,
  "assignedByUserId" TEXT,
  "assignmentType" "AssignmentType" NOT NULL,
  "reason" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "endReason" TEXT,
  "siteId" TEXT NOT NULL,
  "metadata" JSONB,
  CONSTRAINT "LeadAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LeadAssignment_leadId_startedAt_idx" ON "LeadAssignment"("leadId", "startedAt");
CREATE INDEX IF NOT EXISTS "LeadAssignment_assigneeUserId_startedAt_idx" ON "LeadAssignment"("assigneeUserId", "startedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "LeadAssignment_one_open_per_lead" ON "LeadAssignment"("leadId") WHERE "endedAt" IS NULL;

CREATE TABLE IF NOT EXISTS "LeadFollowUp" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "type" "FollowUpType" NOT NULL,
  "priority" "FollowUpPriority" NOT NULL,
  "reason" TEXT,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" "FollowUpStatus" NOT NULL,
  "completedAt" TIMESTAMP(3),
  "completedByUserId" TEXT,
  "outcome" TEXT,
  "nextFollowUpId" TEXT,
  "rescheduledFromId" TEXT,
  "cancelReason" TEXT,
  "slaScheduleId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadFollowUp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LeadFollowUp_leadId_createdAt_idx" ON "LeadFollowUp"("leadId", "createdAt");
CREATE INDEX IF NOT EXISTS "LeadFollowUp_status_dueAt_idx" ON "LeadFollowUp"("status", "dueAt");
CREATE INDEX IF NOT EXISTS "LeadFollowUp_ownerUserId_dueAt_idx" ON "LeadFollowUp"("ownerUserId", "dueAt");

CREATE TABLE IF NOT EXISTS "CounsellingSession" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "counsellorUserId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "attendanceStatus" "SessionAttendance" NOT NULL,
  "notes" TEXT,
  "recordedByUserId" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CounsellingSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CounsellingSession_bookingId_idx" ON "CounsellingSession"("bookingId");
CREATE INDEX IF NOT EXISTS "CounsellingSession_leadId_recordedAt_idx" ON "CounsellingSession"("leadId", "recordedAt");
CREATE INDEX IF NOT EXISTS "CounsellingSession_counsellorUserId_recordedAt_idx" ON "CounsellingSession"("counsellorUserId", "recordedAt");

CREATE TABLE IF NOT EXISTS "CounsellingOutcome" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "recommendation" "CounsellingRecommendation" NOT NULL,
  "recommendedByUserId" TEXT NOT NULL,
  "rationale" TEXT,
  "nextActionType" TEXT,
  "nextActionAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CounsellingOutcome_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CounsellingOutcome_sessionId_key" ON "CounsellingOutcome"("sessionId");
CREATE INDEX IF NOT EXISTS "CounsellingOutcome_leadId_createdAt_idx" ON "CounsellingOutcome"("leadId", "createdAt");
CREATE INDEX IF NOT EXISTS "CounsellingOutcome_recommendation_idx" ON "CounsellingOutcome"("recommendation");

CREATE TABLE IF NOT EXISTS "LeadAttribution" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "firstTouchAt" TIMESTAMP(3) NOT NULL,
  "firstTouchSource" "LeadSource" NOT NULL,
  "firstTouchCampaignId" TEXT,
  "firstTouchMedium" TEXT,
  "firstTouchChannel" TEXT,
  "firstTouchCreativeRef" TEXT,
  "firstTouchLandingUrl" TEXT,
  "firstTouchReferralPartnerId" TEXT,
  "firstTouchUtm" JSONB,
  "lastTouchAt" TIMESTAMP(3) NOT NULL,
  "lastTouchSource" "LeadSource" NOT NULL,
  "lastTouchCampaignId" TEXT,
  "lastTouchMedium" TEXT,
  "lastTouchChannel" TEXT,
  "lastTouchCreativeRef" TEXT,
  "lastTouchLandingUrl" TEXT,
  "lastTouchReferralPartnerId" TEXT,
  "lastTouchUtm" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadAttribution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LeadAttribution_leadId_key" ON "LeadAttribution"("leadId");
CREATE INDEX IF NOT EXISTS "LeadAttribution_firstTouchCampaignId_createdAt_idx" ON "LeadAttribution"("firstTouchCampaignId", "createdAt");
CREATE INDEX IF NOT EXISTS "LeadAttribution_lastTouchCampaignId_updatedAt_idx" ON "LeadAttribution"("lastTouchCampaignId", "updatedAt");

CREATE TABLE IF NOT EXISTS "LeadAttributionHistory" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "touchAt" TIMESTAMP(3) NOT NULL,
  "source" "LeadSource" NOT NULL,
  "campaignId" TEXT,
  "medium" TEXT,
  "channel" TEXT,
  "creativeRef" TEXT,
  "landingUrl" TEXT,
  "referralPartnerId" TEXT,
  "utm" JSONB,
  "touchType" "TouchType" NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadAttributionHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LeadAttributionHistory_leadId_touchAt_idx" ON "LeadAttributionHistory"("leadId", "touchAt");
CREATE INDEX IF NOT EXISTS "LeadAttributionHistory_campaignId_touchAt_idx" ON "LeadAttributionHistory"("campaignId", "touchAt");

CREATE TABLE IF NOT EXISTS "LeadMerge" (
  "id" TEXT NOT NULL,
  "duplicateCaseId" TEXT,
  "winnerLeadId" TEXT NOT NULL,
  "loserLeadId" TEXT NOT NULL,
  "decidedByUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "activityCopyStrategy" "MergeCopyStrategy" NOT NULL,
  "activitiesCopiedCount" INTEGER NOT NULL,
  "mergedAt" TIMESTAMP(3) NOT NULL,
  "auditRef" TEXT,
  CONSTRAINT "LeadMerge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LeadMerge_loserLeadId_key" ON "LeadMerge"("loserLeadId");

CREATE TABLE IF NOT EXISTS "DuplicateCase" (
  "id" TEXT NOT NULL,
  "leftLeadId" TEXT NOT NULL,
  "rightLeadId" TEXT NOT NULL,
  "matchLevel" "MatchLevel" NOT NULL,
  "matchSignals" JSONB NOT NULL,
  "matchScore" INTEGER NOT NULL,
  "detectedAt" TIMESTAMP(3) NOT NULL,
  "reviewStatus" "DupReviewStatus" NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "mergeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DuplicateCase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DuplicateCase_mergeId_key" ON "DuplicateCase"("mergeId");
CREATE INDEX IF NOT EXISTS "DuplicateCase_reviewStatus_matchLevel_detectedAt_idx" ON "DuplicateCase"("reviewStatus", "matchLevel", "detectedAt");
CREATE INDEX IF NOT EXISTS "DuplicateCase_leftLeadId_idx" ON "DuplicateCase"("leftLeadId");
CREATE INDEX IF NOT EXISTS "DuplicateCase_rightLeadId_idx" ON "DuplicateCase"("rightLeadId");
CREATE UNIQUE INDEX IF NOT EXISTS "DuplicateCase_pair_matchLevel_key" ON "DuplicateCase" (LEAST("leftLeadId", "rightLeadId"), GREATEST("leftLeadId", "rightLeadId"), "matchLevel");

CREATE TABLE IF NOT EXISTS "LeadConversion" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "targetType" "ConversionTarget" NOT NULL,
  "targetEntityId" TEXT NOT NULL,
  "decidedByUserId" TEXT NOT NULL,
  "eligibilitySnapshot" JSONB NOT NULL,
  "outboxEventId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  CONSTRAINT "LeadConversion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LeadConversion_leadId_key" ON "LeadConversion"("leadId");

CREATE TABLE IF NOT EXISTS "LeadConfig" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "payloadSchemaRef" TEXT NOT NULL,
  "ownerRole" "UserRole" NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "effectiveFrom" TIMESTAMP(3),
  "effectiveUntil" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  CONSTRAINT "LeadConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LeadConfig_key_version_key" ON "LeadConfig"("key", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "LeadConfig_one_active_per_key" ON "LeadConfig"("key") WHERE "isActive" = true;
CREATE INDEX IF NOT EXISTS "LeadConfig_key_effectiveFrom_idx" ON "LeadConfig"("key", "effectiveFrom");
ALTER TABLE "LeadConfig" DROP CONSTRAINT IF EXISTS "LeadConfig_sod_check";
ALTER TABLE "LeadConfig" ADD CONSTRAINT "LeadConfig_sod_check" CHECK ("approvedByUserId" IS NULL OR "approvedByUserId" <> "createdByUserId");

CREATE TABLE IF NOT EXISTS "LeadOutboxDlq" (
  "id" TEXT NOT NULL,
  "originalEventId" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "failureReason" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL,
  "movedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  "resolutionAction" "DlqResolution",
  CONSTRAINT "LeadOutboxDlq_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NotificationTemplate" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "provider" "NotificationProvider" NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "variables" JSONB NOT NULL,
  "language" "LeadLanguage" NOT NULL,
  "version" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationTemplate_key_channel_language_version_key" ON "NotificationTemplate"("key", "channel", "language", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationTemplate_one_active" ON "NotificationTemplate"("key", "channel", "language") WHERE "isActive" = true;
CREATE INDEX IF NOT EXISTS "NotificationTemplate_channel_isActive_idx" ON "NotificationTemplate"("channel", "isActive");

CREATE TABLE IF NOT EXISTS "NotificationDeliveryLog" (
  "id" TEXT NOT NULL,
  "leadId" TEXT,
  "templateId" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "provider" "NotificationProvider" NOT NULL,
  "recipient" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL,
  "providerMessageId" TEXT,
  "deliveryStatus" "DeliveryStatus" NOT NULL,
  "statusUpdatedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "dncCheckedAt" TIMESTAMP(3) NOT NULL,
  "dncPassed" BOOLEAN NOT NULL,
  "payloadHash" TEXT,
  CONSTRAINT "NotificationDeliveryLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "NotificationDeliveryLog_leadId_sentAt_idx" ON "NotificationDeliveryLog"("leadId", "sentAt");
CREATE INDEX IF NOT EXISTS "NotificationDeliveryLog_deliveryStatus_sentAt_idx" ON "NotificationDeliveryLog"("deliveryStatus", "sentAt");
CREATE INDEX IF NOT EXISTS "NotificationDeliveryLog_provider_sentAt_idx" ON "NotificationDeliveryLog"("provider", "sentAt");
CREATE INDEX IF NOT EXISTS "NotificationDeliveryLog_recipient_sentAt_idx" ON "NotificationDeliveryLog"("recipient", "sentAt");

-- Foreign keys (idempotent)
DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_latestScoreId_fkey" FOREIGN KEY ("latestScoreId") REFERENCES "LeadScore"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_activeAssignmentId_fkey" FOREIGN KEY ("activeAssignmentId") REFERENCES "LeadAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_mergedIntoLeadId_fkey" FOREIGN KEY ("mergedIntoLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_duplicateOfLeadId_fkey" FOREIGN KEY ("duplicateOfLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LeadStatusHistory" ADD CONSTRAINT "LeadStatusHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadStatusHistory" ADD CONSTRAINT "LeadStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadStatusHistory" ADD CONSTRAINT "LeadStatusHistory_outboxEventId_fkey" FOREIGN KEY ("outboxEventId") REFERENCES "LeadOutboxEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LeadScore" ADD CONSTRAINT "LeadScore_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadScore" ADD CONSTRAINT "LeadScore_computedByUserId_fkey" FOREIGN KEY ("computedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LeadFollowUp" ADD CONSTRAINT "LeadFollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadFollowUp" ADD CONSTRAINT "LeadFollowUp_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadFollowUp" ADD CONSTRAINT "LeadFollowUp_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadFollowUp" ADD CONSTRAINT "LeadFollowUp_nextFollowUpId_fkey" FOREIGN KEY ("nextFollowUpId") REFERENCES "LeadFollowUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadFollowUp" ADD CONSTRAINT "LeadFollowUp_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "LeadFollowUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadFollowUp" ADD CONSTRAINT "LeadFollowUp_slaScheduleId_fkey" FOREIGN KEY ("slaScheduleId") REFERENCES "SlaSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CallDisposition" ADD CONSTRAINT "CallDisposition_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "LeadActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CallDisposition" ADD CONSTRAINT "CallDisposition_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "LeadFollowUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CounsellingBooking" ADD CONSTRAINT "CounsellingBooking_rescheduledFromBookingId_fkey" FOREIGN KEY ("rescheduledFromBookingId") REFERENCES "CounsellingBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CounsellingBooking" ADD CONSTRAINT "CounsellingBooking_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CounsellingSession" ADD CONSTRAINT "CounsellingSession_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "CounsellingBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CounsellingSession" ADD CONSTRAINT "CounsellingSession_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CounsellingSession" ADD CONSTRAINT "CounsellingSession_counsellorUserId_fkey" FOREIGN KEY ("counsellorUserId") REFERENCES "User"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CounsellingSession" ADD CONSTRAINT "CounsellingSession_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CounsellingOutcome" ADD CONSTRAINT "CounsellingOutcome_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CounsellingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CounsellingOutcome" ADD CONSTRAINT "CounsellingOutcome_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CounsellingOutcome" ADD CONSTRAINT "CounsellingOutcome_recommendedByUserId_fkey" FOREIGN KEY ("recommendedByUserId") REFERENCES "User"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LeadAttribution" ADD CONSTRAINT "LeadAttribution_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadAttribution" ADD CONSTRAINT "LeadAttribution_firstTouchCampaignId_fkey" FOREIGN KEY ("firstTouchCampaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadAttribution" ADD CONSTRAINT "LeadAttribution_lastTouchCampaignId_fkey" FOREIGN KEY ("lastTouchCampaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LeadAttributionHistory" ADD CONSTRAINT "LeadAttributionHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadAttributionHistory" ADD CONSTRAINT "LeadAttributionHistory_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LeadMerge" ADD CONSTRAINT "LeadMerge_winnerLeadId_fkey" FOREIGN KEY ("winnerLeadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadMerge" ADD CONSTRAINT "LeadMerge_loserLeadId_fkey" FOREIGN KEY ("loserLeadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadMerge" ADD CONSTRAINT "LeadMerge_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadMerge" ADD CONSTRAINT "LeadMerge_duplicateCaseId_fkey" FOREIGN KEY ("duplicateCaseId") REFERENCES "DuplicateCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DuplicateCase" ADD CONSTRAINT "DuplicateCase_leftLeadId_fkey" FOREIGN KEY ("leftLeadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DuplicateCase" ADD CONSTRAINT "DuplicateCase_rightLeadId_fkey" FOREIGN KEY ("rightLeadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DuplicateCase" ADD CONSTRAINT "DuplicateCase_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DuplicateCase" ADD CONSTRAINT "DuplicateCase_mergeId_fkey" FOREIGN KEY ("mergeId") REFERENCES "LeadMerge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LeadConversion" ADD CONSTRAINT "LeadConversion_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadConversion" ADD CONSTRAINT "LeadConversion_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadConversion" ADD CONSTRAINT "LeadConversion_outboxEventId_fkey" FOREIGN KEY ("outboxEventId") REFERENCES "LeadOutboxEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LeadConfig" ADD CONSTRAINT "LeadConfig_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadConfig" ADD CONSTRAINT "LeadConfig_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LeadOutboxDlq" ADD CONSTRAINT "LeadOutboxDlq_originalEventId_fkey" FOREIGN KEY ("originalEventId") REFERENCES "LeadOutboxEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeadOutboxDlq" ADD CONSTRAINT "LeadOutboxDlq_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CrmSyncQueue" ADD CONSTRAINT "CrmSyncQueue_outboxEventId_fkey" FOREIGN KEY ("outboxEventId") REFERENCES "LeadOutboxEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NotificationTemplate" ADD CONSTRAINT "NotificationTemplate_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NotificationDeliveryLog" ADD CONSTRAINT "NotificationDeliveryLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "NotificationDeliveryLog" ADD CONSTRAINT "NotificationDeliveryLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
