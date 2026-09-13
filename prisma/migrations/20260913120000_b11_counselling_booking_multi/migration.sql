-- B11: allow multiple CounsellingBooking rows per Lead.
-- Drops whole-table uniqueness on leadId only.
-- Enforces at most one SCHEDULED booking per Lead (partial unique).

DROP INDEX IF EXISTS "CounsellingBooking_leadId_key";

CREATE INDEX IF NOT EXISTS "CounsellingBooking_leadId_createdAt_idx"
ON "CounsellingBooking" ("leadId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "CounsellingBooking_one_scheduled_per_lead"
ON "CounsellingBooking" ("leadId")
WHERE "bookingStatus" = 'SCHEDULED';
