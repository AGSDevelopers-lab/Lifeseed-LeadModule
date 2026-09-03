-- Reports Module v1 · additive-only (new enums + tables)

CREATE TYPE "ReportCategory" AS ENUM ('CLINICAL', 'FINANCE', 'LOGISTICS', 'COMPLIANCE', 'REGULATORY', 'OPERATIONAL');
CREATE TYPE "ReportCadence" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ON_DEMAND');
CREATE TYPE "ReportExportFormat" AS ENUM ('CSV', 'XLSX', 'PDF', 'JSON');
CREATE TYPE "ReportDeliveryChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'DOWNLOAD_LINK');
CREATE TYPE "ReportTriggeredBy" AS ENUM ('MANUAL', 'SCHEDULED', 'API');

CREATE TABLE "ReportSchedule" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "cadence" "ReportCadence" NOT NULL,
    "filterValues" JSONB NOT NULL,
    "exportFormat" "ReportExportFormat" NOT NULL,
    "subscriberUserIds" TEXT[],
    "deliveryChannel" "ReportDeliveryChannel" NOT NULL DEFAULT 'EMAIL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportRun" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "runByUserId" TEXT,
    "triggeredBy" "ReportTriggeredBy" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "rowCount" INTEGER,
    "exportFormat" "ReportExportFormat",
    "exportUrl" TEXT,
    "errorMessage" TEXT,
    "filterSnapshot" JSONB NOT NULL,
    "scheduleId" TEXT,

    CONSTRAINT "ReportRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportDeliveryLog" (
    "id" TEXT NOT NULL,
    "reportRunId" TEXT NOT NULL,
    "subscriberUserId" TEXT NOT NULL,
    "channel" "ReportDeliveryChannel" NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "succeeded" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,

    CONSTRAINT "ReportDeliveryLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportSnapshot" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "snapshotName" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedByUserId" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "filterSnapshot" JSONB NOT NULL,
    "isImmutable" BOOLEAN NOT NULL DEFAULT true,
    "retentionExpiresAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "ReportSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "savedFilters" JSONB,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportFavorite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportSchedule_reportId_idx" ON "ReportSchedule"("reportId");
CREATE INDEX "ReportSchedule_nextRunAt_isActive_idx" ON "ReportSchedule"("nextRunAt", "isActive");
CREATE INDEX "ReportSchedule_createdByUserId_idx" ON "ReportSchedule"("createdByUserId");

CREATE INDEX "ReportRun_reportId_idx" ON "ReportRun"("reportId");
CREATE INDEX "ReportRun_startedAt_idx" ON "ReportRun"("startedAt");
CREATE INDEX "ReportRun_scheduleId_idx" ON "ReportRun"("scheduleId");

CREATE INDEX "ReportDeliveryLog_reportRunId_idx" ON "ReportDeliveryLog"("reportRunId");
CREATE INDEX "ReportDeliveryLog_subscriberUserId_idx" ON "ReportDeliveryLog"("subscriberUserId");

CREATE INDEX "ReportSnapshot_reportId_idx" ON "ReportSnapshot"("reportId");
CREATE INDEX "ReportSnapshot_capturedAt_idx" ON "ReportSnapshot"("capturedAt");

CREATE INDEX "ReportFavorite_userId_idx" ON "ReportFavorite"("userId");
CREATE UNIQUE INDEX "ReportFavorite_userId_reportId_displayName_key" ON "ReportFavorite"("userId", "reportId", "displayName");

ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_runByUserId_fkey" FOREIGN KEY ("runByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ReportSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReportDeliveryLog" ADD CONSTRAINT "ReportDeliveryLog_reportRunId_fkey" FOREIGN KEY ("reportRunId") REFERENCES "ReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportDeliveryLog" ADD CONSTRAINT "ReportDeliveryLog_subscriberUserId_fkey" FOREIGN KEY ("subscriberUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_capturedByUserId_fkey" FOREIGN KEY ("capturedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportFavorite" ADD CONSTRAINT "ReportFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
