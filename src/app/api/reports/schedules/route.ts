import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ReportCadence,
  ReportDeliveryChannel,
  ReportExportFormat,
  type Prisma,
} from "@prisma/client";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  ForbiddenError,
  UnauthorizedError,
  requirePermission,
} from "@/lib/rbac";
import { computeNextRunAt } from "@/lib/reports/scheduler";
import {
  COMPARE_PRESETS,
  DATA_WINDOW_PRESETS,
  isValidCron,
  type ScheduleDetail,
} from "@/lib/reports/schedule-presets";

const scheduleDetailSchema = z.object({
  hour: z.number().int().min(0).max(23).default(8),
  minute: z.number().int().min(0).max(59).default(0),
  dayOfWeek: z.number().int().min(1).max(7).optional(),
  dayOfMonth: z.union([z.number().int().min(1).max(28), z.literal("LAST")]).optional(),
  quarterMonth: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  month: z.number().int().min(1).max(12).optional(),
  cron: z.string().optional(),
});

const createSchema = z.object({
  reportId: z.string().min(1),
  cadence: z.nativeEnum(ReportCadence),
  filterValues: z.record(z.string(), z.unknown()).default({}),
  exportFormat: z.nativeEnum(ReportExportFormat),
  subscriberUserIds: z.array(z.string()).default([]),
  deliveryChannel: z
    .nativeEnum(ReportDeliveryChannel)
    .default(ReportDeliveryChannel.EMAIL),
  scheduleDetail: scheduleDetailSchema.optional(),
  dataWindowPreset: z.enum(DATA_WINDOW_PRESETS).optional(),
  dataWindowCustomFrom: z.string().optional(),
  dataWindowCustomTo: z.string().optional(),
  comparePreset: z.enum(COMPARE_PRESETS).nullable().optional(),
  compareCustomFrom: z.string().optional(),
  compareCustomTo: z.string().optional(),
});

function parseOptionalDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET() {
  try {
    const session = await requirePermission("report.schedule");
    const schedules = await prisma.reportSchedule.findMany({
      where: { createdByUserId: session.userId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ schedules });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const session = await requirePermission("report.schedule");
    const json: unknown = await req.json();
    const body = createSchema.parse(json);

    if (body.cadence === ReportCadence.CUSTOM) {
      const cron = body.scheduleDetail?.cron?.trim() ?? "";
      if (!isValidCron(cron)) {
        return NextResponse.json(
          { error: "Enter a valid 5-field cron expression (min hour dom month dow)" },
          { status: 400 },
        );
      }
    }

    const subscribers =
      body.subscriberUserIds.length > 0
        ? body.subscriberUserIds
        : [session.userId];

    const detail: ScheduleDetail = {
      hour: body.scheduleDetail?.hour ?? 8,
      minute: body.scheduleDetail?.minute ?? 0,
      dayOfWeek: body.scheduleDetail?.dayOfWeek,
      dayOfMonth: body.scheduleDetail?.dayOfMonth,
      quarterMonth: body.scheduleDetail?.quarterMonth,
      month: body.scheduleDetail?.month,
      cron: body.scheduleDetail?.cron,
    };

    const schedule = await prisma.reportSchedule.create({
      data: {
        reportId: body.reportId,
        cadence: body.cadence,
        filterValues: body.filterValues as Prisma.InputJsonValue,
        exportFormat: body.exportFormat,
        subscriberUserIds: subscribers,
        deliveryChannel: body.deliveryChannel,
        createdByUserId: session.userId,
        scheduleDetail: detail as Prisma.InputJsonValue,
        dataWindowPreset: body.dataWindowPreset ?? "TRAILING_30D",
        dataWindowCustomFrom: parseOptionalDate(body.dataWindowCustomFrom),
        dataWindowCustomTo: parseOptionalDate(body.dataWindowCustomTo),
        comparePreset: body.comparePreset ?? null,
        compareCustomFrom: parseOptionalDate(body.compareCustomFrom),
        compareCustomTo: parseOptionalDate(body.compareCustomTo),
        nextRunAt: computeNextRunAt(body.cadence, new Date(), detail),
        isActive: true,
      },
    });

    await audit.log({
      actorUserId: session.userId,
      action: "report.schedule.create",
      entityType: "ReportSchedule",
      entityId: schedule.id,
      afterJson: { reportId: body.reportId, cadence: body.cadence },
    });

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
