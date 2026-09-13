import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BookingStatus,
  CounsellingBookingStatus,
  CounsellingMode,
  CounsellingRecommendation,
  LeadActivityType,
  LeadEventType,
  MergeCopyStrategy,
  PrismaClient,
  SessionAttendance,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadEnv } from "vite";

vi.mock("server-only", () => ({}));

import { detectAndCreateDuplicateCases } from "./duplicate";
import { mergeDuplicateCase } from "./merge";
import { LeadConvertedMergeLoserError, LeadMergeAlreadyExistsError } from "../domain/errors";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const loaded = loadEnv("", root, "");
const DATABASE_URL = process.env.DATABASE_URL ?? loaded.DATABASE_URL;
const MARKER = "b14-merge-20991309";

describe.skipIf(!DATABASE_URL)("B14 merge + duplicate (Postgres)", () => {
  const dbIt = (name: string, fn: () => Promise<void>) => it(name, fn, 60_000);
  const prisma = new PrismaClient();
  let userId = "";
  const actor = { userId: "", roles: ["OPS_MANAGER", "BANK_SUPER_ADMIN"], siteId: null as string | null };

  async function cleanup() {
    const leads = await prisma.lead.findMany({
      where: { OR: [{ fullName: MARKER }, { leadCode: { startsWith: "LED-KOL-20990913-9" } }] },
      select: { id: true },
    });
    const ids = leads.map((l) => l.id);
    if (ids.length === 0) return;
    await prisma.duplicateCase.updateMany({
      where: { OR: [{ leftLeadId: { in: ids } }, { rightLeadId: { in: ids } }] },
      data: { mergeId: null },
    });
    await prisma.leadMerge.deleteMany({
      where: { OR: [{ winnerLeadId: { in: ids } }, { loserLeadId: { in: ids } }] },
    });
    await prisma.duplicateCase.deleteMany({
      where: { OR: [{ leftLeadId: { in: ids } }, { rightLeadId: { in: ids } }] },
    });
    await prisma.counsellingOutcome.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.counsellingSession.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.counsellingBooking.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.callDisposition.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.leadFollowUp.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.leadActivity.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.leadStatusHistory.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.leadOutboxEvent.deleteMany({ where: { aggregateId: { in: ids } } });
    await prisma.lead.deleteMany({ where: { id: { in: ids } } });
  }

  beforeAll(async () => {
    vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });
    process.env.LEAD_DUPLICATE_ENABLED = "on";
    const user = await prisma.user.findFirst({ select: { id: true } });
    if (!user) throw new Error("B14 postgres tests require a User row");
    userId = user.id;
    actor.userId = userId;
    await cleanup();
  }, 60_000);

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  }, 60_000);

  beforeEach(async () => {
    process.env.LEAD_DUPLICATE_ENABLED = "on";
    await cleanup();
  }, 60_000);

  async function pair(seq: number, opts?: { converted?: boolean; phone?: string; email?: string; name?: string }) {
    const phone = opts?.phone ?? `90000${seq}`;
    const pad = (n: number) => `LED-KOL-20990913-${String(n).padStart(4, "0")}`;
    const winner = await prisma.lead.create({
      data: {
        leadCode: pad(seq),
        personType: "DONOR",
        source: "WEB_FORM",
        fullName: MARKER,
        phone: `${phone}1`,
        email: opts?.email ?? `w${seq}@b14.test`,
        status: "ASSIGNED",
        consentDataProcessing: true,
      },
    });
    const loser = await prisma.lead.create({
      data: {
        leadCode: pad(seq + 1),
        personType: "DONOR",
        source: "WEB_FORM",
        fullName: MARKER,
        phone: `${phone}2`,
        email: `l${seq}@b14.test`,
        status: "ASSIGNED",
        consentDataProcessing: true,
        convertedDonorId: opts?.converted ? `b14donor${seq}` : undefined,
      },
    });
    const dup = await prisma.duplicateCase.create({
      data: {
        leftLeadId: winner.id < loser.id ? winner.id : loser.id,
        rightLeadId: winner.id < loser.id ? loser.id : winner.id,
        matchLevel: "EXACT",
        matchSignals: { phoneExact: true },
        matchScore: 100,
        detectedAt: new Date(),
        reviewStatus: "OPEN",
      },
    });
    return { winner, loser, dup };
  }

  dbIt("rejects converted loser", async () => {
    const { winner, dup } = await pair(9800, { converted: true });
    await expect(
      mergeDuplicateCase({
        duplicateCaseId: dup.id,
        winnerLeadId: winner.id,
        reason: "same person",
        strategy: MergeCopyStrategy.REFERENCE_ONLY,
        actor,
      }),
    ).rejects.toBeInstanceOf(LeadConvertedMergeLoserError);
  });

  dbIt("merges a non-converted loser and emits audit + outbox once", async () => {
    const { winner, loser, dup } = await pair(9810);
    const result = await mergeDuplicateCase({
      duplicateCaseId: dup.id,
      winnerLeadId: winner.id,
      reason: "ops confirmed",
      strategy: MergeCopyStrategy.REFERENCE_ONLY,
      actor,
    });
    expect(result.mergeId).toBeTruthy();
    const updated = await prisma.duplicateCase.findUniqueOrThrow({ where: { id: dup.id } });
    expect(updated.reviewStatus).toBe("MERGED");
    expect(updated.mergeId).toBe(result.mergeId);
    const loserAfter = await prisma.lead.findUniqueOrThrow({ where: { id: loser.id } });
    expect(loserAfter.outcome).toBe("MERGED");
    expect(loserAfter.mergedIntoLeadId).toBe(winner.id);
    const audits = await prisma.auditLog.findMany({
      where: { entityId: loser.id, action: "lead.merge" },
    });
    expect(audits.length).toBe(1);
    const outbox = await prisma.leadOutboxEvent.findMany({
      where: { aggregateId: loser.id, eventType: LeadEventType.LeadMerged },
    });
    expect(outbox.length).toBe(1);
  });

  dbIt("rejects a second merge of the same loser via loserLeadId unique", async () => {
    const { winner, loser, dup } = await pair(9820);
    await mergeDuplicateCase({
      duplicateCaseId: dup.id,
      winnerLeadId: winner.id,
      reason: "first",
      strategy: MergeCopyStrategy.REFERENCE_ONLY,
      actor,
    });
    const extra = await prisma.lead.create({
      data: {
        leadCode: "LED-KOL-20990913-9822",
        personType: "DONOR",
        source: "WEB_FORM",
        fullName: MARKER,
        phone: "900001119",
        status: "ASSIGNED",
        consentDataProcessing: true,
      },
    });
    const dup2 = await prisma.duplicateCase.create({
      data: {
        leftLeadId: extra.id < loser.id ? extra.id : loser.id,
        rightLeadId: extra.id < loser.id ? loser.id : extra.id,
        matchLevel: "EXACT",
        matchSignals: {},
        matchScore: 100,
        detectedAt: new Date(),
        reviewStatus: "OPEN",
      },
    });
    await expect(
      mergeDuplicateCase({
        duplicateCaseId: dup2.id,
        winnerLeadId: extra.id,
        reason: "second",
        strategy: MergeCopyStrategy.REFERENCE_ONLY,
        actor,
      }),
    ).rejects.toBeInstanceOf(LeadMergeAlreadyExistsError);
  });

  dbIt("COPY_MEANINGFUL copies only CALL/COUNSELLING/NOTE/CONVERSION activities", async () => {
    const { winner, loser, dup } = await pair(9830);
    await prisma.leadActivity.createMany({
      data: [
        { leadId: loser.id, activityType: LeadActivityType.CALL, occurredAt: new Date(), summary: "call" },
        { leadId: loser.id, activityType: LeadActivityType.NOTE, occurredAt: new Date(), summary: "note" },
        { leadId: loser.id, activityType: LeadActivityType.SMS, occurredAt: new Date(), summary: "sms" },
      ],
    });
    await mergeDuplicateCase({
      duplicateCaseId: dup.id,
      winnerLeadId: winner.id,
      reason: "meaningful",
      strategy: MergeCopyStrategy.COPY_MEANINGFUL,
      actor,
    });
    const copied = await prisma.leadActivity.findMany({
      where: { leadId: winner.id, metadata: { path: ["mergeSourceLeadId"], equals: loser.id } },
    });
    const types = copied.map((a) => a.activityType).sort();
    expect(types).toEqual(["CALL", "NOTE"]);
  });

  dbIt("REFERENCE_ONLY writes a single MERGE summary on the winner", async () => {
    const { winner, loser, dup } = await pair(9840);
    await prisma.leadActivity.create({
      data: { leadId: loser.id, activityType: LeadActivityType.NOTE, occurredAt: new Date(), summary: "keep" },
    });
    await mergeDuplicateCase({
      duplicateCaseId: dup.id,
      winnerLeadId: winner.id,
      reason: "ref",
      strategy: MergeCopyStrategy.REFERENCE_ONLY,
      actor,
    });
    const winnerActs = await prisma.leadActivity.findMany({ where: { leadId: winner.id } });
    const merges = winnerActs.filter((a) => a.activityType === LeadActivityType.MERGE);
    expect(merges.length).toBe(1);
    const loserActs = await prisma.leadActivity.findMany({ where: { leadId: loser.id, summary: "keep" } });
    expect(loserActs.length).toBe(1);
  });

  dbIt("COPY_ALL copies a real B11 counselling booking/session/outcome without orphaning", async () => {
    const { winner, loser, dup } = await pair(9850);
    const booking = await prisma.counsellingBooking.create({
      data: {
        leadId: loser.id,
        scheduledAt: new Date("2026-09-20T10:00:00.000Z"),
        mode: CounsellingMode.VIDEO_CALL,
        counsellorUserId: userId,
        status: CounsellingBookingStatus.ATTENDED,
        bookingStatus: BookingStatus.CLOSED,
      },
    });
    const session = await prisma.counsellingSession.create({
      data: {
        bookingId: booking.id,
        leadId: loser.id,
        counsellorUserId: userId,
        attendanceStatus: SessionAttendance.ATTENDED,
        notes: "b11 original",
        recordedByUserId: userId,
        recordedAt: new Date(),
      },
    });
    await prisma.counsellingOutcome.create({
      data: {
        sessionId: session.id,
        leadId: loser.id,
        recommendation: CounsellingRecommendation.RECOMMEND_REGISTER,
        recommendedByUserId: userId,
        rationale: "ok",
      },
    });
    await mergeDuplicateCase({
      duplicateCaseId: dup.id,
      winnerLeadId: winner.id,
      reason: "copy all counselling",
      strategy: MergeCopyStrategy.COPY_ALL,
      actor,
    });
    const winnerBookings = await prisma.counsellingBooking.findMany({ where: { leadId: winner.id } });
    const winnerSessions = await prisma.counsellingSession.findMany({ where: { leadId: winner.id } });
    const winnerOutcomes = await prisma.counsellingOutcome.findMany({ where: { leadId: winner.id } });
    expect(winnerBookings).toHaveLength(1);
    expect(winnerSessions).toHaveLength(1);
    expect(winnerOutcomes).toHaveLength(1);
    expect(winnerSessions[0]?.bookingId).toBe(winnerBookings[0]?.id);
    expect(winnerOutcomes[0]?.sessionId).toBe(winnerSessions[0]?.id);
    expect(winnerSessions[0]?.notes).toContain(loser.id);
    const loserBookings = await prisma.counsellingBooking.findMany({ where: { leadId: loser.id } });
    expect(loserBookings).toHaveLength(1);
  });

  dbIt("rolls back all five steps on a forced mid-transaction failure", async () => {
    const { winner, loser, dup } = await pair(9860);
    await expect(
      mergeDuplicateCase({
        duplicateCaseId: dup.id,
        winnerLeadId: winner.id,
        reason: "boom",
        strategy: MergeCopyStrategy.REFERENCE_ONLY,
        actor,
        throwAfterWrites: true,
      }),
    ).rejects.toThrow(/forced mid-transaction failure/);
    expect(await prisma.leadMerge.count({ where: { loserLeadId: loser.id } })).toBe(0);
    const still = await prisma.duplicateCase.findUniqueOrThrow({ where: { id: dup.id } });
    expect(still.reviewStatus).toBe("OPEN");
    expect(still.mergeId).toBeNull();
    const loserAfter = await prisma.lead.findUniqueOrThrow({ where: { id: loser.id } });
    expect(loserAfter.outcome).not.toBe("MERGED");
  });

  dbIt("intake-path: matching contact creates DuplicateCase; distinct contact does not", async () => {
    const existing = await prisma.lead.create({
      data: {
        leadCode: "LED-KOL-20990913-9870",
        personType: "DONOR",
        source: "WEB_FORM",
        fullName: MARKER,
        phone: "91111-2222",
        email: "same@b14.test",
        status: "NEW",
        consentDataProcessing: true,
      },
    });
    const twin = await prisma.lead.create({
      data: {
        leadCode: "LED-KOL-20990913-9871",
        personType: "DONOR",
        source: "WEB_FORM",
        fullName: MARKER,
        phone: "911112222",
        email: "other@b14.test",
        status: "NEW",
        consentDataProcessing: true,
      },
    });
    const cases = await detectAndCreateDuplicateCases({
      id: twin.id,
      fullName: twin.fullName,
      phone: twin.phone,
      email: twin.email,
    });
    expect(cases.some((c) => c.matchLevel === "EXACT")).toBe(true);

    const unique = await prisma.lead.create({
      data: {
        leadCode: "LED-KOL-20990913-9872",
        personType: "DONOR",
        source: "WEB_FORM",
        fullName: "Unique Person",
        phone: "8000000001",
        email: "unique@b14.test",
        status: "NEW",
        consentDataProcessing: true,
      },
    });
    const none = await detectAndCreateDuplicateCases({
      id: unique.id,
      fullName: unique.fullName,
      phone: unique.phone,
      email: unique.email,
    });
    expect(none.filter((c) => c.leftLeadId === unique.id || c.rightLeadId === unique.id)).toHaveLength(0);
    expect(existing.id).toBeTruthy();
  });

  dbIt("intake-path Tier 2: name+phone combined rules create PROBABLE DuplicateCase", async () => {
    const a = await prisma.lead.create({
      data: {
        leadCode: "LED-KOL-20990913-9880",
        personType: "DONOR",
        source: "WEB_FORM",
        fullName: "Priya Sharma",
        phone: "70000-1111",
        status: "NEW",
        consentDataProcessing: true,
      },
    });
    const b = await prisma.lead.create({
      data: {
        leadCode: "LED-KOL-20990913-9881",
        personType: "DONOR",
        source: "WEB_FORM",
        fullName: "priya  sharma",
        phone: "700001111",
        status: "NEW",
        consentDataProcessing: true,
      },
    });
    const cases = await detectAndCreateDuplicateCases(
      { id: b.id, fullName: b.fullName, phone: b.phone, email: b.email },
      {
        phoneExact: false,
        emailExact: false,
        namePhoneFuzzy: true,
        nameEmailFuzzy: true,
      },
    );
    expect(cases.some((c) => c.matchLevel === "PROBABLE" && c.matchScore === 70)).toBe(true);
    expect(a.id).toBeTruthy();
  });
});
