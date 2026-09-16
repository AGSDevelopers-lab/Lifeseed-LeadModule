import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadEnv } from "vite";

vi.mock("server-only", () => ({}));

import { captureTouch, computeCampaignCac } from "./attribution";
import { backfillLeadAttribution } from "./backfill-lead-attribution";
import {
  activateCampaign,
  createCampaign,
  endCampaign,
  getCampaign,
  listCampaigns,
  patchCampaign,
} from "./campaign";
import { CampaignIllegalTransitionError, LeadPermissionDeniedError } from "../domain/errors";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const loaded = loadEnv("", root, "");
const DATABASE_URL = process.env.DATABASE_URL ?? loaded.DATABASE_URL;
const MARKER = "b15-attr-20990913";

describe.skipIf(!DATABASE_URL)("B15 campaign + attribution (Postgres)", () => {
  const dbIt = (name: string, fn: () => Promise<void>) => it(name, fn, 60_000);
  const prisma = new PrismaClient() as any;
  const prismaB = new PrismaClient() as any;
  let userId = "";
  const marketing = {
    userId: "",
    roles: ["MARKETING_MANAGER"],
    siteId: null as string | null,
  };
  const telecaller = {
    userId: "",
    roles: ["TELECALLER"],
    siteId: null as string | null,
  };

  async function cleanup() {
    const leads = await prisma.lead.findMany({
      where: { OR: [{ fullName: MARKER }, { leadCode: { startsWith: "LED-B15-" } }] },
      select: { id: true },
    });
    const ids = leads.map((l: any) => l.id);
    if (ids.length) {
      await prisma.slaSchedule.deleteMany({ where: { entityId: { in: ids } } });
      await prisma.leadOutboxEvent.deleteMany({ where: { aggregateId: { in: ids } } });
      await prisma.leadAttributionHistory.deleteMany({ where: { leadId: { in: ids } } });
      await prisma.leadAttribution.deleteMany({ where: { leadId: { in: ids } } });
      await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.campaign.deleteMany({ where: { code: { startsWith: "B15_" } } });
  }

  beforeAll(async () => {
    const user = await prisma.user.findFirst({ select: { id: true } });
    if (!user) throw new Error("B15 postgres tests require a User row");
    userId = user.id;
    marketing.userId = userId;
    telecaller.userId = userId;
    await cleanup();
  }, 60_000);

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
    await prismaB.$disconnect();
  }, 60_000);

  beforeEach(async () => {
    await cleanup();
  }, 60_000);

  async function makeLead(seq: number, personType: "DONOR" | "RECIPIENT" = "DONOR") {
    return prisma.lead.create({
      data: {
        leadCode: `LED-B15-${String(seq).padStart(4, "0")}`,
        personType,
        source: "WEB_FORM",
        fullName: MARKER,
        phone: `91111${seq}`,
        consentDataProcessing: true,
      },
    });
  }

  dbIt("C+E+T campaign CRUD and RBAC at application layer", async () => {
    const created = await createCampaign(
      marketing,
      {
        name: "B15 CRUD",
        code: "B15_CRUD",
        source: "WEB_FORM",
        startAt: new Date(),
        ownerUserId: userId,
        actualSpendInr: "1000",
      },
      prisma,
    );
    expect(created.status).toBe("DRAFT");
    const listed = await listCampaigns(marketing, prisma);
    expect(listed.some((c) => c.id === created.id)).toBe(true);
    const one = await getCampaign(marketing, created.id, prisma);
    expect(one.code).toBe("B15_CRUD");
    const patched = await patchCampaign(marketing, created.id, { notes: "n1" }, prisma);
    expect(patched.notes).toBe("n1");
    await expect(listCampaigns(telecaller, prisma)).rejects.toBeInstanceOf(LeadPermissionDeniedError);
    await expect(createCampaign(telecaller, {
      name: "x",
      code: "B15_NO",
      source: "WEB_FORM",
      startAt: new Date(),
      ownerUserId: userId,
    }, prisma)).rejects.toBeInstanceOf(LeadPermissionDeniedError);
  });

  dbIt("D full campaign lifecycle matrix", async () => {
    const c = await createCampaign(marketing, {
      name: "B15 LC",
      code: "B15_LC",
      source: "WEB_FORM",
      startAt: new Date(),
      ownerUserId: userId,
    }, prisma);
    await expect(endCampaign(marketing, c.id, prisma)).rejects.toBeInstanceOf(CampaignIllegalTransitionError);
    await expect(patchCampaign(marketing, c.id, { status: "PAUSED" }, prisma)).rejects.toBeInstanceOf(
      CampaignIllegalTransitionError,
    );
    const active = await activateCampaign(marketing, c.id, prisma);
    expect(active.status).toBe("ACTIVE");
    const paused = await patchCampaign(marketing, c.id, { status: "PAUSED" }, prisma);
    expect(paused.status).toBe("PAUSED");
    const reactivated = await activateCampaign(marketing, c.id, prisma);
    expect(reactivated.status).toBe("ACTIVE");
    await expect(patchCampaign(marketing, c.id, { status: "ENDED" }, prisma)).rejects.toBeInstanceOf(
      CampaignIllegalTransitionError,
    );
    await expect(patchCampaign(marketing, c.id, { status: "DRAFT" }, prisma)).rejects.toBeInstanceOf(
      CampaignIllegalTransitionError,
    );
    const ended = await endCampaign(marketing, c.id, prisma);
    expect(ended.status).toBe("ENDED");
    await expect(activateCampaign(marketing, c.id, prisma)).rejects.toBeInstanceOf(CampaignIllegalTransitionError);
    await expect(patchCampaign(marketing, c.id, { status: "PAUSED" }, prisma)).rejects.toBeInstanceOf(
      CampaignIllegalTransitionError,
    );
  });

  dbIt("F sequential first-touch immutability", async () => {
    const lead = await makeLead(1);
    await captureTouch({ leadId: lead.id, source: "WEB_FORM", medium: "first", db: prisma });
    const before = await prisma.leadAttribution.findUniqueOrThrow({ where: { leadId: lead.id } });
    await captureTouch({ leadId: lead.id, source: "API", medium: "second", db: prisma });
    const after = await prisma.leadAttribution.findUniqueOrThrow({ where: { leadId: lead.id } });
    expect(after.firstTouchSource).toBe(before.firstTouchSource);
    expect(after.firstTouchMedium).toBe("first");
    expect(after.firstTouchAt.toISOString()).toBe(before.firstTouchAt.toISOString());
    expect(after.lastTouchMedium).toBe("second");
  });

  dbIt("F concurrent first-touch: one winner, no firstTouch corruption", async () => {
    const lead = await makeLead(2);
    const results = await Promise.allSettled([
      captureTouch({ leadId: lead.id, source: "WEB_FORM", medium: "A", db: prisma }),
      captureTouch({ leadId: lead.id, source: "API", medium: "B", db: prismaB }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(2);
    const rows = await prisma.leadAttribution.findMany({ where: { leadId: lead.id } });
    expect(rows).toHaveLength(1);
    expect(["A", "B"]).toContain(rows[0].firstTouchMedium);
    const history = await prisma.leadAttributionHistory.findMany({ where: { leadId: lead.id } });
    expect(history).toHaveLength(2);
    expect(history.filter((h: any) => h.touchType === "FIRST")).toHaveLength(1);
    expect(history.filter((h: any) => h.touchType === "SUBSEQUENT")).toHaveLength(1);
  });

  dbIt("G+H sequential last-touch and append-only history", async () => {
    const lead = await makeLead(3);
    await captureTouch({ leadId: lead.id, source: "WEB_FORM", medium: "1", db: prisma });
    await captureTouch({ leadId: lead.id, source: "API", medium: "2", db: prisma });
    await captureTouch({ leadId: lead.id, source: "MANUAL", medium: "3", db: prisma });
    const attr = await prisma.leadAttribution.findUniqueOrThrow({ where: { leadId: lead.id } });
    expect(attr.lastTouchMedium).toBe("3");
    const hist = await prisma.leadAttributionHistory.findMany({
      where: { leadId: lead.id },
      orderBy: { capturedAt: "asc" },
    });
    expect(hist).toHaveLength(3);
    expect(hist[0].touchType).toBe("FIRST");
    expect(hist[1].touchType).toBe("SUBSEQUENT");
    expect(hist[2].touchType).toBe("SUBSEQUENT");
    expect(hist.map((h: any) => h.medium)).toEqual(["1", "2", "3"]);
  });

  dbIt("G+H concurrent subsequent: no dropped/dup history, lastTouch matches latest history", async () => {
    const lead = await makeLead(4);
    await captureTouch({ leadId: lead.id, source: "WEB_FORM", medium: "seed", db: prisma });
    await Promise.all([
      captureTouch({
        leadId: lead.id,
        source: "API",
        medium: "c1",
        capturedAt: new Date("2099-01-01T00:00:01.000Z"),
        db: prisma,
      }),
      captureTouch({
        leadId: lead.id,
        source: "MANUAL",
        medium: "c2",
        capturedAt: new Date("2099-01-01T00:00:02.000Z"),
        db: prismaB,
      }),
    ]);
    const hist = await prisma.leadAttributionHistory.findMany({ where: { leadId: lead.id } });
    expect(hist).toHaveLength(3);
    const attr = await prisma.leadAttribution.findUniqueOrThrow({ where: { leadId: lead.id } });
    const latest = [...hist].sort((a, b) => {
      const t = a.capturedAt.getTime() - b.capturedAt.getTime();
      return t !== 0 ? t : a.id.localeCompare(b.id);
    }).at(-1);
    expect(attr.lastTouchMedium).toBe(latest?.medium);
    expect(attr.lastTouchAt.toISOString()).toBe(latest?.touchAt.toISOString());
  });

  dbIt("I sequential rapid retry: one attribution row, history grows, no throw", async () => {
    const lead = await makeLead(5);
    await captureTouch({ leadId: lead.id, source: "WEB_FORM", db: prisma });
    await captureTouch({ leadId: lead.id, source: "WEB_FORM", db: prisma });
    await captureTouch({ leadId: lead.id, source: "WEB_FORM", db: prisma });
    expect(await prisma.leadAttribution.count({ where: { leadId: lead.id } })).toBe(1);
    expect(await prisma.leadAttributionHistory.count({ where: { leadId: lead.id } })).toBe(3);
  });

  dbIt("I concurrent overlapping captureTouch rules out six failure modes", async () => {
    const lead = await makeLead(6);
    const settled = await Promise.allSettled([
      captureTouch({ leadId: lead.id, source: "WEB_FORM", medium: "x", db: prisma }),
      captureTouch({ leadId: lead.id, source: "API", medium: "y", db: prismaB }),
    ]);
    const rejected = settled.filter((s) => s.status === "rejected");
    expect(rejected).toEqual([]);
    const attrs = await prisma.leadAttribution.findMany({ where: { leadId: lead.id } });
    expect(attrs).toHaveLength(1);
    const first = attrs[0];
    expect(["x", "y"]).toContain(first.firstTouchMedium);
    const hist = await prisma.leadAttributionHistory.findMany({ where: { leadId: lead.id } });
    expect(hist).toHaveLength(2);
    const latest = [...hist].sort((a, b) => {
      const t = a.capturedAt.getTime() - b.capturedAt.getTime();
      return t !== 0 ? t : a.id.localeCompare(b.id);
    }).at(-1);
    expect(first.lastTouchMedium).toBe(latest?.medium);
  });

  dbIt("J campaign resolution by exact code; unmatched raw tag preserved", async () => {
    const camp = await createCampaign(marketing, {
      name: "Named Differently",
      code: "B15_CODE_EXACT",
      source: "SOCIAL_INSTAGRAM",
      startAt: new Date(),
      ownerUserId: userId,
    }, prisma);
    const lead = await makeLead(7);
    await captureTouch({
      leadId: lead.id,
      source: "WEB_FORM",
      utm: { campaign: "B15_CODE_EXACT" },
      db: prisma,
    });
    const hit = await prisma.leadAttribution.findUniqueOrThrow({ where: { leadId: lead.id } });
    expect(hit.firstTouchCampaignId).toBe(camp.id);
    const lead2 = await makeLead(8);
    await captureTouch({
      leadId: lead2.id,
      source: "WEB_FORM",
      utm: { campaign: "Named Differently" },
      db: prisma,
    });
    const miss = await prisma.leadAttribution.findUniqueOrThrow({ where: { leadId: lead2.id } });
    expect(miss.firstTouchCampaignId).toBeNull();
    const utm = miss.firstTouchUtm as { campaign?: string };
    expect(utm.campaign).toBe("Named Differently");
  });

  dbIt("K attribution without campaign uses Lead.source", async () => {
    const lead = await makeLead(9);
    await captureTouch({ leadId: lead.id, source: lead.source, db: prisma });
    const row = await prisma.leadAttribution.findUniqueOrThrow({ where: { leadId: lead.id } });
    expect(row.firstTouchSource).toBe("WEB_FORM");
    expect(row.firstTouchCampaignId).toBeNull();
  });

  dbIt("L+M+N CAC last-touch formula, scope disjoint, zero-lead null", async () => {
    const camp = await createCampaign(marketing, {
      name: "B15 CAC",
      code: "B15_CAC",
      source: "WEB_FORM",
      startAt: new Date(),
      ownerUserId: userId,
      actualSpendInr: "300",
    }, prisma);
    const zeroCamp = await createCampaign(marketing, {
      name: "B15 ZERO",
      code: "B15_ZERO",
      source: "WEB_FORM",
      startAt: new Date(),
      ownerUserId: userId,
      actualSpendInr: "50",
    }, prisma);
    const d1 = await makeLead(10, "DONOR");
    const d2 = await makeLead(11, "DONOR");
    const r1 = await makeLead(12, "RECIPIENT");
    await captureTouch({ leadId: d1.id, source: "WEB_FORM", campaignId: camp.id, db: prisma });
    await captureTouch({ leadId: d2.id, source: "WEB_FORM", campaignId: camp.id, db: prisma });
    await captureTouch({ leadId: r1.id, source: "WEB_FORM", campaignId: camp.id, db: prisma });
    const donor = await computeCampaignCac({ actor: marketing, scope: "donor", db: prisma });
    const recip = await computeCampaignCac({ actor: marketing, scope: "recipient", db: prisma });
    const dRow = donor.find((x) => x.campaignId === camp.id);
    const rRow = recip.find((x) => x.campaignId === camp.id);
    expect(dRow?.leadCount).toBe(2);
    expect(dRow?.cac).toBe(150);
    expect(rRow?.leadCount).toBe(1);
    expect(rRow?.cac).toBe(300);
    const z = donor.find((x) => x.campaignId === zeroCamp.id);
    expect(z?.leadCount).toBe(0);
    expect(z?.cac).toBeNull();
    await expect(
      computeCampaignCac({ actor: telecaller, scope: "donor", db: prisma }),
    ).rejects.toBeInstanceOf(LeadPermissionDeniedError);
  });

  dbIt("Q flag OFF writes zero attribution rows; lead create still succeeds", async () => {
    process.env.LEAD_ATTRIBUTION_ENABLED = "off";
    const { persistNewLead } = await import("@/lib/leads/create-lead");
    const lead = await persistNewLead({
      personType: "DONOR",
      source: "WEB_FORM",
      fullName: MARKER,
      phone: "9888815001",
      consentMarketing: false,
      consentScreening: false,
      consentDataProcessing: true,
      consentVersion: "v1",
    });
    expect(lead.id).toBeTruthy();
    expect(await prisma.leadAttribution.count({ where: { leadId: lead.id } })).toBe(0);
  });

  dbIt("O+P backfill idempotent and does not overwrite live attribution", async () => {
    const live = await makeLead(13);
    await captureTouch({ leadId: live.id, source: "API", medium: "live", db: prisma });
    const plain = await makeLead(14);
    const first = await backfillLeadAttribution(prisma);
    expect(first.inserted).toBeGreaterThanOrEqual(1);
    const before = await prisma.leadAttribution.findUniqueOrThrow({ where: { leadId: live.id } });
    const second = await backfillLeadAttribution(prisma);
    expect(second.inserted).toBe(0);
    const after = await prisma.leadAttribution.findUniqueOrThrow({ where: { leadId: live.id } });
    expect(after.firstTouchMedium).toBe("live");
    expect(after.firstTouchSource).toBe(before.firstTouchSource);
    expect(await prisma.leadAttribution.count({ where: { leadId: plain.id } })).toBe(1);
    expect(await prisma.leadAttributionHistory.count({ where: { leadId: plain.id } })).toBe(1);
  });
});
