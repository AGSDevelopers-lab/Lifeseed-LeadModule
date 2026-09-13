/**
 * B11 one-SCHEDULED-per-Lead concurrency evidence.
 *
 * Hits the real persistBundle counselling_booking write path (two interactive
 * transactions in parallel), not a sequential pre-check and not a raw INSERT
 * that bypasses the store.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BookingStatus, CounsellingBookingStatus, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadEnv } from "vite";

vi.mock("server-only", () => ({}));

import { PrismaLeadTransitionStore } from "./prisma-transition-store";
import { aLead } from "../testing/fixtures/aLead";
import { LeadStatus } from "../domain/enums";
import { LeadInvariantViolationError } from "../domain/errors";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const loaded = loadEnv("", root, "");
const DATABASE_URL = process.env.DATABASE_URL ?? loaded.DATABASE_URL;
const MARKER = "b11-concurrency-20990101";
const LEAD_CODE = "LED-KOL-20990101-9911";

describe.skipIf(!DATABASE_URL)("B11 one-SCHEDULED booking concurrency (Postgres)", () => {
  const prisma = new PrismaClient();
  const store = new PrismaLeadTransitionStore(prisma as never);
  let leadId = "";
  let counsellorUserId = "";
  let actorUserId = "";

  beforeAll(async () => {
    const user = await prisma.user.findFirst({ select: { id: true } });
    if (!user) {
      throw new Error("B11 concurrency test requires at least one User row");
    }
    counsellorUserId = user.id;
    actorUserId = user.id;

    await prisma.counsellingBooking.deleteMany({
      where: { lead: { fullName: MARKER } },
    });
    await prisma.lead.deleteMany({ where: { OR: [{ leadCode: LEAD_CODE }, { fullName: MARKER }] } });

    const lead = await prisma.lead.create({
      data: {
        leadCode: LEAD_CODE,
        personType: "RECIPIENT",
        source: "WEB_FORM",
        fullName: MARKER,
        status: "CONTACTED_QUALIFIED",
        consentDataProcessing: true,
      },
    });
    leadId = lead.id;
  }, 60_000);

  afterAll(async () => {
    if (leadId) {
      await prisma.counsellingSession.deleteMany({ where: { leadId } });
      await prisma.counsellingBooking.deleteMany({ where: { leadId } });
      await prisma.leadActivity.deleteMany({ where: { leadId } });
      await prisma.leadStatusHistory.deleteMany({ where: { leadId } });
      await prisma.leadOutboxEvent.deleteMany({ where: { aggregateId: leadId } });
      await prisma.lead.deleteMany({ where: { id: leadId } });
    }
    await prisma.$disconnect();
  }, 60_000);

  it("rejects a concurrent second SCHEDULED booking and leaves exactly one", async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'CounsellingBooking'
    `;
    const names = indexes.map((i) => i.indexname);
    expect(names).toContain("CounsellingBooking_one_scheduled_per_lead");
    expect(names).not.toContain("CounsellingBooking_leadId_key");

    const domainLead = aLead({
      id: leadId,
      code: LEAD_CODE,
      status: LeadStatus.CONTACTED_QUALIFIED,
    });

    const write = {
      kind: "counselling_booking" as const,
      counsellorUserId,
      scheduledAt: new Date("2099-01-02T10:00:00.000Z"),
      mode: "VIDEO_CALL",
      durationMinutes: 30,
    };

    const run = (slot: Date) =>
      store.persistBundle({
        lead: domainLead,
        nextStatus: LeadStatus.COUNSELLING_BOOKED,
        writes: [{ ...write, scheduledAt: slot }],
        actorUserId,
        actorRole: "OPS_MANAGER",
        now: new Date(),
      });

    const results = await Promise.allSettled([
      run(new Date("2099-01-02T10:00:00.000Z")),
      run(new Date("2099-01-02T11:00:00.000Z")),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    const reason = (rejected[0] as PromiseRejectedResult).reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    expect(
      reason instanceof LeadInvariantViolationError ||
        message.includes("SCHEDULED") ||
        message.includes("Unique constraint"),
    ).toBe(true);

    const scheduled = await prisma.counsellingBooking.count({
      where: { leadId, bookingStatus: BookingStatus.SCHEDULED },
    });
    expect(scheduled).toBe(1);

    const historical = await prisma.counsellingBooking.create({
      data: {
        leadId,
        counsellorUserId,
        scheduledAt: new Date("2099-01-01T09:00:00.000Z"),
        mode: "PHONE",
        status: CounsellingBookingStatus.RESCHEDULED,
        bookingStatus: BookingStatus.RESCHEDULED,
      },
    });
    expect(historical.bookingStatus).toBe(BookingStatus.RESCHEDULED);
    const total = await prisma.counsellingBooking.count({ where: { leadId } });
    expect(total).toBe(2);
    const stillOneScheduled = await prisma.counsellingBooking.count({
      where: { leadId, bookingStatus: BookingStatus.SCHEDULED },
    });
    expect(stillOneScheduled).toBe(1);
  }, 60_000);
});
