-- B09: LeadConfig SoD + uniqueness already shipped in B01 foundation.
-- This migration is a no-op guard so deploy scripts have a B09 marker.
ALTER TABLE "LeadConfig" DROP CONSTRAINT IF EXISTS "LeadConfig_sod_check";
ALTER TABLE "LeadConfig" ADD CONSTRAINT "LeadConfig_sod_check"
  CHECK ("approvedByUserId" IS NULL OR "approvedByUserId" <> "createdByUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "LeadConfig_key_version_key" ON "LeadConfig"("key", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "LeadConfig_one_active_per_key" ON "LeadConfig"("key") WHERE "isActive" = true;
