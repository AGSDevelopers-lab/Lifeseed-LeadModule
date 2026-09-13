import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { counsellingBookingToDomain } from "./mappers/counselling-booking-mapper";
import { counsellingSessionToDomain } from "./mappers/counselling-session-mapper";
import { counsellingOutcomeToDomain } from "./mappers/counselling-outcome-mapper";

export async function loadCounsellingBookingById(id: string) {
  const row = await prisma.counsellingBooking.findUnique({
    where: { id },
    include: {
      sessions: { include: { outcome: true }, orderBy: { recordedAt: "asc" } },
      lead: { select: { id: true, leadCode: true, fullName: true } },
    },
  });
  if (!row) return null;
  return {
    booking: counsellingBookingToDomain(row),
    lead: row.lead,
    sessions: row.sessions.map((s) => ({
      session: counsellingSessionToDomain(s),
      outcome: s.outcome ? counsellingOutcomeToDomain(s.outcome) : null,
    })),
  };
}

export async function listCounsellingCalendar(input: {
  counsellorUserId?: string;
  from: Date;
  to: Date;
}) {
  const rows = await prisma.counsellingBooking.findMany({
    where: {
      scheduledAt: { gte: input.from, lt: input.to },
      ...(input.counsellorUserId
        ? { counsellorUserId: input.counsellorUserId }
        : {}),
    },
    include: { lead: { select: { id: true, leadCode: true, fullName: true } } },
    orderBy: { scheduledAt: "asc" },
    take: 500,
  });
  return rows.map((row) => ({
    booking: counsellingBookingToDomain(row),
    lead: row.lead,
  }));
}

export async function listLeadCounsellingHistory(leadId: string) {
  const rows = await prisma.counsellingBooking.findMany({
    where: { leadId },
    include: {
      sessions: { include: { outcome: true }, orderBy: { recordedAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    booking: counsellingBookingToDomain(row),
    sessions: row.sessions.map((s) => ({
      session: counsellingSessionToDomain(s),
      outcome: s.outcome ? counsellingOutcomeToDomain(s.outcome) : null,
    })),
  }));
}

export async function listCounsellorWorkspace(counsellorUserId: string, now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const weekEnd = new Date(start);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const [today, upcoming, closedAttended, closedNoShow] = await Promise.all([
    prisma.counsellingBooking.findMany({
      where: {
        counsellorUserId,
        scheduledAt: { gte: start, lt: end },
        bookingStatus: BookingStatus.SCHEDULED,
      },
      include: { lead: { select: { leadCode: true, fullName: true, city: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.counsellingBooking.findMany({
      where: {
        counsellorUserId,
        scheduledAt: { gte: end, lt: weekEnd },
        bookingStatus: BookingStatus.SCHEDULED,
      },
      include: { lead: { select: { leadCode: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 20,
    }),
    prisma.counsellingBooking.count({
      where: { counsellorUserId, bookingStatus: BookingStatus.CLOSED, status: "ATTENDED" },
    }),
    prisma.counsellingBooking.count({
      where: { counsellorUserId, bookingStatus: BookingStatus.CLOSED, status: "NO_SHOW" },
    }),
  ]);
  return { today, upcoming, closedAttended, closedNoShow };
}

export async function listOverdueScheduledBookings(now: Date, graceMs: number, take: number) {
  const cutoff = new Date(now.getTime() - graceMs);
  return prisma.counsellingBooking.findMany({
    where: {
      bookingStatus: BookingStatus.SCHEDULED,
      scheduledAt: { lt: cutoff },
    },
    select: { id: true, leadId: true, scheduledAt: true },
    take,
  });
}

export async function listReminderCandidates(now: Date) {
  const in25h = new Date(now.getTime() + 25 * 3600_000);
  const in23h = new Date(now.getTime() + 23 * 3600_000);
  const in3h = new Date(now.getTime() + 3 * 3600_000);
  const in1h = new Date(now.getTime() + 1 * 3600_000);
  const due24 = await prisma.counsellingBooking.findMany({
    where: {
      bookingStatus: BookingStatus.SCHEDULED,
      reminderSentAt: null,
      scheduledAt: { gte: in23h, lte: in25h },
    },
    take: 200,
  });
  const due2 = await prisma.counsellingBooking.findMany({
    where: {
      bookingStatus: BookingStatus.SCHEDULED,
      scheduledAt: { gte: in1h, lte: in3h },
    },
    take: 200,
  });
  return { due24, due2 };
}

export async function markReminderSent(bookingId: string, at: Date) {
  await prisma.counsellingBooking.update({
    where: { id: bookingId },
    data: { reminderSentAt: at },
  });
}
