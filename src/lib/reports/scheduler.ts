import "server-only";

import {
  ReportDeliveryChannel,
  ReportTriggeredBy,
  type ReportCadence,
  type ReportSchedule,
} from "@prisma/client";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { sendReportEmail } from "@/lib/reports/notifications/email-adapter";
import { getReport } from "@/lib/reports/registry";
import { exportReport } from "@/lib/reports/runner";
import type { SessionUser } from "@/lib/rbac";
import type { ReportFilters } from "@/lib/reports/types";
import {
  computeNextRunAt,
  isoDateIst,
  parseScheduleDetail,
  resolveCompareWindow,
  resolveDataWindow,
  type ComparePreset,
  type DataWindowPreset,
} from "@/lib/reports/schedule-presets";

export { computeNextRunAt } from "@/lib/reports/schedule-presets";

function safeNextRunAt(
  cadence: ReportCadence,
  from: Date,
  detail: ReturnType<typeof parseScheduleDetail>,
): Date {
  try {
    return computeNextRunAt(cadence, from, detail);
  } catch {
    return new Date(from.getTime() + 24 * 60 * 60 * 1000);
  }
}

function buildRunFilters(
  schedule: ReportSchedule,
  now: Date,
): ReportFilters {
  const saved = (schedule.filterValues ?? {}) as ReportFilters;
  if (!schedule.dataWindowPreset) {
    return saved;
  }
  const window = resolveDataWindow(
    schedule.dataWindowPreset as DataWindowPreset | null,
    now,
    schedule.dataWindowCustomFrom,
    schedule.dataWindowCustomTo,
  );
  const filters: ReportFilters = {
    ...saved,
    fromDate: isoDateIst(window.from),
    toDate: isoDateIst(window.to),
  };

  const compare = resolveCompareWindow(
    schedule.comparePreset as ComparePreset | null,
    window,
    schedule.compareCustomFrom,
    schedule.compareCustomTo,
  );
  if (compare) {
    filters.compareFromDate = isoDateIst(compare.from);
    filters.compareToDate = isoDateIst(compare.to);
    filters.comparePreset = schedule.comparePreset;
  }
  return filters;
}

export async function runDueSchedules(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const now = new Date();
  const due = await prisma.reportSchedule.findMany({
    where: {
      isActive: true,
      nextRunAt: { lte: now },
    },
    take: 50,
  });

  let succeeded = 0;
  let failed = 0;

  for (const schedule of due) {
    const detail = parseScheduleDetail(schedule.scheduleDetail);
    try {
      const creator = await prisma.user.findUnique({
        where: { id: schedule.createdByUserId },
        include: { roles: true },
      });
      if (!creator) {
        failed += 1;
        continue;
      }

      const user: SessionUser = {
        userId: creator.id,
        email: creator.email,
        roles: creator.roles.map((r) => r.role),
        siteId: creator.siteId,
        clinicId: creator.clinicId,
        assignments: creator.roles.map((r) => ({
          role: r.role,
          scopeType: r.scopeType,
          scopeId: r.scopeId,
        })),
      };

      getReport(schedule.reportId, user);

      const filters = buildRunFilters(schedule, now);
      const format =
        schedule.exportFormat === "CSV"
          ? "CSV"
          : schedule.exportFormat === "XLSX"
            ? "XLSX"
            : schedule.exportFormat === "PDF"
              ? "PDF"
              : "JSON";

      const exported = await exportReport(
        schedule.reportId,
        filters,
        format,
        user,
      );

      await prisma.reportRun.update({
        where: { id: exported.runId },
        data: {
          triggeredBy: ReportTriggeredBy.SCHEDULED,
          scheduleId: schedule.id,
          runByUserId: null,
          filterSnapshot: filters,
        },
      });

      const subscribers = await prisma.user.findMany({
        where: { id: { in: schedule.subscriberUserIds } },
      });

      for (const sub of subscribers) {
        let ok = false;
        let errMsg: string | null = null;
        try {
          if (schedule.deliveryChannel === ReportDeliveryChannel.EMAIL) {
            await sendReportEmail({
              to: sub.email,
              subject: `Scheduled report: ${schedule.reportId}`,
              bodyHtml: `<p>Your scheduled LifeSeed report <strong>${schedule.reportId}</strong> is ready.</p>
<p>Window: ${String(filters.fromDate)} → ${String(filters.toDate)}${
                filters.compareFromDate
                  ? ` · Compare: ${String(filters.compareFromDate)} → ${String(filters.compareToDate)}`
                  : ""
              }</p>`,
              attachmentUrl: exported.signedUrl,
            });
            ok = true;
          } else {
            ok = true;
          }
        } catch (e) {
          errMsg = e instanceof Error ? e.message : "delivery failed";
        }

        await prisma.reportDeliveryLog.create({
          data: {
            reportRunId: exported.runId,
            subscriberUserId: sub.id,
            channel: schedule.deliveryChannel,
            succeeded: ok,
            errorMessage: errMsg,
          },
        });
      }

      await prisma.reportSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          nextRunAt: safeNextRunAt(
            schedule.cadence as ReportCadence,
            now,
            detail,
          ),
        },
      });

      await audit.log({
        actorUserId: null,
        action: "report.schedule.run",
        entityType: "ReportSchedule",
        entityId: schedule.id,
        afterJson: { reportId: schedule.reportId, runId: exported.runId },
      });

      succeeded += 1;
    } catch (e) {
      failed += 1;
      console.error("[reports] schedule run failed", schedule.id, e);
      await prisma.reportSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          nextRunAt: safeNextRunAt(
            schedule.cadence as ReportCadence,
            now,
            detail,
          ),
        },
      });
    }
  }

  return { processed: due.length, succeeded, failed };
}
