import "server-only";

import { ReportExportFormat, ReportTriggeredBy } from "@prisma/client";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/rbac";
import { cacheKey, withCache } from "@/lib/reports/cache";
import { toCsv } from "@/lib/reports/exports/csv-adapter";
import { toPdf } from "@/lib/reports/exports/pdf-adapter";
import { uploadExport } from "@/lib/reports/exports/storage-adapter";
import { toXlsx } from "@/lib/reports/exports/xlsx-adapter";
import { getReport, resolveScopeWhere } from "@/lib/reports/registry";
import type {
  ExportFormat,
  ReportFilters,
  ReportRunResult,
} from "@/lib/reports/types";

function toIst(isoUtc: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(isoUtc));
}

export async function runReport(
  reportId: string,
  filters: ReportFilters,
  user: SessionUser,
): Promise<ReportRunResult> {
  const def = getReport(reportId, user);
  const extraWhere = resolveScopeWhere(def, user);
  const key = cacheKey(reportId, filters, user.userId);
  const ttlMs = (def.caching?.ttlSeconds ?? 300) * 1000;

  const { value: rows, fromCache } = await withCache(key, ttlMs, () =>
    def.query(filters, { user, extraWhere }),
  );

  const generatedAt = new Date().toISOString();
  return {
    reportId: def.id,
    name: def.name,
    category: def.category,
    rows,
    rowCount: rows.length,
    generatedAt,
    generatedAtIst: toIst(generatedAt),
    filters,
    columns: def.columns,
    fromCache,
  };
}

export async function exportReport(
  reportId: string,
  filters: ReportFilters,
  format: ExportFormat,
  user: SessionUser,
): Promise<{
  signedUrl: string | null;
  path: string;
  runId: string;
  dryRun: boolean;
  mimeType: string;
  buffer: Buffer;
}> {
  const result = await runReport(reportId, filters, user);
  const def = getReport(reportId, user);

  const meta = {
    reportName: result.name,
    generatedAtUtc: result.generatedAt,
    generatedAtIst: result.generatedAtIst,
    generatedBy: user.email,
    filters: result.filters,
    rowCount: result.rowCount,
    columns: result.columns,
    rows: result.rows,
  };

  let buffer: Buffer;
  let mimeType: string;
  const exportFormat = format as "CSV" | "XLSX" | "PDF" | "JSON";

  if (format === "CSV") {
    buffer = Buffer.from(toCsv(meta), "utf8");
    mimeType = "text/csv";
  } else if (format === "XLSX") {
    buffer = await toXlsx(meta);
    mimeType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else if (format === "PDF") {
    buffer = await toPdf(meta);
    mimeType = "application/pdf";
  } else {
    buffer = Buffer.from(JSON.stringify(meta, null, 2), "utf8");
    mimeType = "application/json";
  }

  const uploaded = await uploadExport(
    user.userId,
    reportId,
    exportFormat,
    buffer,
  );

  const prismaFormat =
    format === "CSV"
      ? ReportExportFormat.CSV
      : format === "XLSX"
        ? ReportExportFormat.XLSX
        : format === "PDF"
          ? ReportExportFormat.PDF
          : ReportExportFormat.JSON;

  const run = await prisma.reportRun.create({
    data: {
      reportId,
      runByUserId: user.userId,
      triggeredBy: ReportTriggeredBy.MANUAL,
      completedAt: new Date(),
      rowCount: result.rowCount,
      exportFormat: prismaFormat,
      exportUrl: uploaded.signedUrl,
      filterSnapshot: filters,
    },
  });

  await audit.log({
    actorUserId: user.userId,
    action: "report.export",
    entityType: "ReportRun",
    entityId: run.id,
    afterJson: {
      reportId,
      format,
      rowCount: result.rowCount,
      path: uploaded.path,
    },
  });

  return {
    signedUrl: uploaded.signedUrl,
    path: uploaded.path,
    runId: run.id,
    dryRun: uploaded.dryRun,
    mimeType,
    buffer,
  };
}

export async function snapshotReport(
  reportId: string,
  filters: ReportFilters,
  user: SessionUser,
  name: string,
  notes?: string,
): Promise<{ snapshotId: string; dataUrl: string | null }> {
  const exported = await exportReport(reportId, filters, "JSON", user);
  const retentionYears = 25;
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + retentionYears);

  const snap = await prisma.reportSnapshot.create({
    data: {
      reportId,
      snapshotName: name,
      capturedByUserId: user.userId,
      dataUrl: exported.signedUrl ?? exported.path,
      filterSnapshot: filters,
      isImmutable: true,
      retentionExpiresAt: expires,
      notes: notes ?? null,
    },
  });

  await audit.log({
    actorUserId: user.userId,
    action: "report.snapshot",
    entityType: "ReportSnapshot",
    entityId: snap.id,
    afterJson: { reportId, name },
  });

  return { snapshotId: snap.id, dataUrl: exported.signedUrl };
}
