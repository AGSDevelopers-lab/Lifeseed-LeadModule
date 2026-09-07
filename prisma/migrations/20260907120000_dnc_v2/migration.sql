-- B08: LeadDoNotCallList → LeadDoNotCall (keep legacy columns) + compatibility view.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'LeadDoNotCallList'
      AND c.relkind = 'r'
  ) THEN
    ALTER TABLE "LeadDoNotCallList" ADD COLUMN IF NOT EXISTS "channel" "DncChannel";
    ALTER TABLE "LeadDoNotCallList" ADD COLUMN IF NOT EXISTS "value" TEXT;
    ALTER TABLE "LeadDoNotCallList" ADD COLUMN IF NOT EXISTS "normalisedValue" TEXT;
    ALTER TABLE "LeadDoNotCallList" ADD COLUMN IF NOT EXISTS "sourceLeadId" TEXT;
    ALTER TABLE "LeadDoNotCallList" ADD COLUMN IF NOT EXISTS "effectiveFrom" TIMESTAMP(3);
    ALTER TABLE "LeadDoNotCallList" ADD COLUMN IF NOT EXISTS "effectiveUntil" TIMESTAMP(3);
    ALTER TABLE "LeadDoNotCallList" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
    ALTER TABLE "LeadDoNotCallList" ADD COLUMN IF NOT EXISTS "removalAuthorityUserId" TEXT;
    ALTER TABLE "LeadDoNotCallList" ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMP(3);
    ALTER TABLE "LeadDoNotCallList" ADD COLUMN IF NOT EXISTS "removalNote" TEXT;
    ALTER TABLE "LeadDoNotCallList" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3);
    ALTER TABLE "LeadDoNotCallList" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

    UPDATE "LeadDoNotCallList"
    SET
      "createdAt" = COALESCE("createdAt", "addedAt"),
      "updatedAt" = COALESCE("updatedAt", "addedAt"),
      "effectiveFrom" = COALESCE("effectiveFrom", "addedAt"),
      "effectiveUntil" = COALESCE("effectiveUntil", "expiresAt"),
      "createdByUserId" = COALESCE("createdByUserId", "addedByUserId", 'SYSTEM'),
      "channel" = COALESCE(
        "channel",
        CASE
          WHEN "phone" IS NOT NULL AND btrim("phone") <> '' THEN 'PHONE'::"DncChannel"
          ELSE 'EMAIL'::"DncChannel"
        END
      ),
      "value" = COALESCE(
        NULLIF("value", ''),
        NULLIF(btrim("phone"), ''),
        lower(COALESCE("email", ''))
      ),
      "normalisedValue" = COALESCE(
        NULLIF("normalisedValue", ''),
        NULLIF(btrim("phone"), ''),
        lower(COALESCE("email", ''))
      );

    ALTER TABLE "LeadDoNotCallList" ALTER COLUMN "channel" SET NOT NULL;
    ALTER TABLE "LeadDoNotCallList" ALTER COLUMN "value" SET NOT NULL;
    ALTER TABLE "LeadDoNotCallList" ALTER COLUMN "normalisedValue" SET NOT NULL;
    ALTER TABLE "LeadDoNotCallList" ALTER COLUMN "effectiveFrom" SET NOT NULL;
    ALTER TABLE "LeadDoNotCallList" ALTER COLUMN "createdByUserId" SET NOT NULL;
    ALTER TABLE "LeadDoNotCallList" ALTER COLUMN "createdAt" SET NOT NULL;
    ALTER TABLE "LeadDoNotCallList" ALTER COLUMN "updatedAt" SET NOT NULL;
    ALTER TABLE "LeadDoNotCallList" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "LeadDoNotCallList" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

    DROP INDEX IF EXISTS "LeadDoNotCallList_phone_key";

    ALTER TABLE "LeadDoNotCallList" RENAME TO "LeadDoNotCall";
  END IF;
END $$;

ALTER INDEX IF EXISTS "LeadDoNotCallList_pkey" RENAME TO "LeadDoNotCall_pkey";
ALTER INDEX IF EXISTS "LeadDoNotCallList_email_idx" RENAME TO "LeadDoNotCall_email_idx";
ALTER TABLE IF EXISTS "LeadDoNotCall" RENAME CONSTRAINT "LeadDoNotCallList_addedByUserId_fkey" TO "LeadDoNotCall_addedByUserId_fkey";

CREATE INDEX IF NOT EXISTS "LeadDoNotCall_normalisedValue_idx" ON "LeadDoNotCall"("normalisedValue");
CREATE INDEX IF NOT EXISTS "LeadDoNotCall_effectiveUntil_idx" ON "LeadDoNotCall"("effectiveUntil");
CREATE INDEX IF NOT EXISTS "LeadDoNotCall_channel_normalisedValue_idx" ON "LeadDoNotCall"("channel", "normalisedValue");

CREATE UNIQUE INDEX IF NOT EXISTS "LeadDoNotCall_channel_normalisedValue_active_key"
  ON "LeadDoNotCall"("channel", "normalisedValue")
  WHERE "removedAt" IS NULL;

DO $$ BEGIN
  ALTER TABLE "LeadDoNotCall" ADD CONSTRAINT "LeadDoNotCall_sourceLeadId_fkey"
    FOREIGN KEY ("sourceLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeadDoNotCall" ADD CONSTRAINT "LeadDoNotCall_removalAuthorityUserId_fkey"
    FOREIGN KEY ("removalAuthorityUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE VIEW "LeadDoNotCallList" AS
SELECT
  id,
  phone,
  email,
  "createdAt",
  "updatedAt"
FROM "LeadDoNotCall";

CREATE TABLE IF NOT EXISTS "NotificationInApp" (
  "id" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "leadId" TEXT,
  "templateKey" TEXT NOT NULL,
  "payload" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationInApp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NotificationInApp_recipientUserId_createdAt_idx"
  ON "NotificationInApp"("recipientUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "NotificationInApp_leadId_idx" ON "NotificationInApp"("leadId");

DO $$ BEGIN
  ALTER TABLE "NotificationInApp" ADD CONSTRAINT "NotificationInApp_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "NotificationTemplate" (
  "id", "key", "channel", "provider", "subject", "body", "variables", "language", "version", "isActive", "createdAt", "updatedAt"
)
SELECT 'ntpl_sys_in_app', 'lead.system.in_app', 'IN_APP', 'IN_APP', NULL, '{{body}}', '["body"]'::jsonb, 'ENGLISH', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "NotificationTemplate" WHERE "id" = 'ntpl_sys_in_app');

INSERT INTO "NotificationTemplate" (
  "id", "key", "channel", "provider", "subject", "body", "variables", "language", "version", "isActive", "createdAt", "updatedAt"
)
SELECT 'ntpl_sys_email', 'lead.system.email', 'EMAIL', 'RESEND', 'LifeSeed', '{{body}}', '["body"]'::jsonb, 'ENGLISH', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "NotificationTemplate" WHERE "id" = 'ntpl_sys_email');

INSERT INTO "NotificationTemplate" (
  "id", "key", "channel", "provider", "subject", "body", "variables", "language", "version", "isActive", "createdAt", "updatedAt"
)
SELECT 'ntpl_sys_sms', 'lead.system.sms', 'SMS', 'SMS_MAGIC', NULL, '{{body}}', '["body"]'::jsonb, 'ENGLISH', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "NotificationTemplate" WHERE "id" = 'ntpl_sys_sms');

INSERT INTO "NotificationTemplate" (
  "id", "key", "channel", "provider", "subject", "body", "variables", "language", "version", "isActive", "createdAt", "updatedAt"
)
SELECT 'ntpl_sys_whatsapp', 'lead.system.whatsapp', 'WHATSAPP', 'META_WHATSAPP', NULL, '{{body}}', '["body"]'::jsonb, 'ENGLISH', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "NotificationTemplate" WHERE "id" = 'ntpl_sys_whatsapp');
