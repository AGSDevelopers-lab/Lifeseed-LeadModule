-- Reports schedule enhance · additive-only (enum values + nullable columns)

ALTER TYPE "ReportCadence" ADD VALUE 'ANNUALLY';
ALTER TYPE "ReportCadence" ADD VALUE 'CUSTOM';

ALTER TABLE "ReportSchedule" ADD COLUMN "scheduleDetail" JSONB;
ALTER TABLE "ReportSchedule" ADD COLUMN "dataWindowPreset" TEXT;
ALTER TABLE "ReportSchedule" ADD COLUMN "dataWindowCustomFrom" TIMESTAMP(3);
ALTER TABLE "ReportSchedule" ADD COLUMN "dataWindowCustomTo" TIMESTAMP(3);
ALTER TABLE "ReportSchedule" ADD COLUMN "comparePreset" TEXT;
ALTER TABLE "ReportSchedule" ADD COLUMN "compareCustomFrom" TIMESTAMP(3);
ALTER TABLE "ReportSchedule" ADD COLUMN "compareCustomTo" TIMESTAMP(3);
