/**
 * B13: LeadAssignment_one_open_per_lead must hold under concurrent inserts.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnv } from "vite";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const loaded = loadEnv("", root, "");
const DATABASE_URL = process.env.DATABASE_URL ?? loaded.DATABASE_URL;
const MARKER = "b13-concurrency-20990113";
const LEAD_CODE = "LED-KOL-20990113-9913";

describe.skipIf(!DATABASE_URL)("B13 one-open assignment concurrency (Postgres)", () => {
  const prisma = new PrismaClient();
  let leadId = "";
  let userA = "";
  let userB = "";
  let siteId = "";

  beforeAll(async () => {
    const user = await prisma.user.findFirst({ select: { id: true, siteId: true } });
    const user2 = await prisma.user.findFirst({
      where: user ? { id: { not: user.id } } : undefined,
      select: { id: true },
    });
    if (!user) throw new Error("B13 concurrency test requires a User row");
    userA = user.id;
    userB = user2?.id ?? user.id;
    const site = await prisma.site.findFirst({ select: { id: true } });
    if (!site) throw new Error("B13 concurrency test requires a Site row");
    siteId = user.siteId ?? site.id;

    await prisma.leadAssignment.deleteMany({ where: { lead: { fullName: MARKER } } });
    await prisma.lead.deleteMany({ where: { OR: [{ leadCode: LEAD_CODE }, { fullName: MARKER }] } });
    const lead = await prisma.lead.create({
      data: {
        leadCode: LEAD_CODE,
        personType: "DONOR",
        source: "WEB_FORM",
        fullName: MARKER,
        status: "NEW",
        consentDataProcessing: true,
      },
    });
    leadId = lead.id;
  }, 60_000);

  afterAll(async () => {
    if (leadId) {
      await prisma.leadAssignment.deleteMany({ where: { leadId } });
      await prisma.lead.deleteMany({ where: { id: leadId } });
    }
    await prisma.$disconnect();
  }, 60_000);

  it("keeps exactly one open assignment under concurrent inserts", async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'LeadAssignment'
    `;
    expect(indexes.map((i) => i.indexname)).toContain("LeadAssignment_one_open_per_lead");

    const startedAt = new Date();
    const results = await Promise.allSettled([
      prisma.leadAssignment.create({
        data: {
          leadId,
          assigneeUserId: userA,
          assignmentType: "MANUAL",
          startedAt,
          siteId,
        },
      }),
      prisma.leadAssignment.create({
        data: {
          leadId,
          assigneeUserId: userB,
          assignmentType: "MANUAL",
          startedAt,
          siteId,
        },
      }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    const open = await prisma.leadAssignment.count({
      where: { leadId, endedAt: null },
    });
    expect(open).toBe(1);
  });
});
