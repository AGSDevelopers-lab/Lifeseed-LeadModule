import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CrmEntityType,
  CrmSyncStatus,
  CrmSyncTarget,
  LeadEvent,
  LeadPersonType,
  LeadSource,
  LeadStatus,
  PrismaClient,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadEnv } from "vite";

vi.mock("server-only", () => ({}));

import { listLeadTimeline } from "./lead-timeline";
import { getLeadAttribution } from "./lead-attribution-read";
import { getLeadCrmStatus } from "./lead-crm-status";
import { TOUCH_RECORD_SCHEMA_MAPPING } from "./lead-attribution-read";
import { archiveLeadV2 } from "./commands";
import { aLead } from "../testing/fixtures/aLead";
import { resolveLeadActions } from "./resolve-lead-actions";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const loaded = loadEnv("", root, "");
const DATABASE_URL = process.env.DATABASE_URL ?? loaded.DATABASE_URL;
const MARKER = "b17a-tl-20990914";
let codeSeq = 0;

describe.skipIf(!DATABASE_URL)("B17-A timeline/attribution/crm (Postgres)", () => {
  const dbIt = (name: string, fn: () => Promise<void>) => it(name, fn, 60_000);
  const prisma = new PrismaClient();
  let userId = "";

  async function cleanup() {
    const leads = await prisma.lead.findMany({
      where: { OR: [{ fullName: MARKER }, { leadCode: { startsWith: "LED-KOL-20990917-" } }] },
      select: { id: true },
    });
    const ids = leads.map((l) => l.id);
    if (!ids.length) return;
    await prisma.crmSyncQueue.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.leadAttributionHistory.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.leadAttribution.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.leadActivity.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.leadStatusHistory.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.lead.deleteMany({ where: { id: { in: ids } } });
  }

  beforeAll(async () => {
    const user = await prisma.user.findFirst({ select: { id: true } });
    if (!user) throw new Error("B17-A postgres tests require a User row");
    userId = user.id;
    await cleanup();
  }, 60_000);

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  }, 60_000);

  beforeEach(async () => {
    await cleanup();
  }, 60_000);

  async function makeLead() {
    codeSeq += 1;
    const n = String(codeSeq).padStart(4, "0");
    return prisma.lead.create({
      data: {
        leadCode: `LED-KOL-20990917-${n}`,
        personType: LeadPersonType.DONOR,
        source: LeadSource.WEB_FORM,
        fullName: MARKER,
        phone: "9800017017",
        status: LeadStatus.ASSIGNED,
      },
    });
  }

  dbIt("G+H identical timestamps: sourceType tie-break is deterministic", async () => {
    const lead = await makeLead();
    const t = new Date("2026-09-14T12:00:00.000Z");
    await prisma.leadStatusHistory.create({
      data: {
        leadId: lead.id,
        toStatus: LeadStatus.ASSIGNED,
        event: LeadEvent.assign,
        occurredAt: t,
        actorUserId: userId,
      },
    });
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        activityType: "NOTE",
        occurredAt: t,
        summary: "same-time note",
        actorUserId: userId,
      },
    });
    const page = await listLeadTimeline(lead.id, { limit: 10 });
    expect(page.items).toHaveLength(2);
    expect(page.items[0].sourceType).toBe("status_history");
    expect(page.items[1].sourceType).toBe("activity");
    expect(page.items[0].occurredAt).toBe(page.items[1].occurredAt);
  });

  dbIt("I+J+K cursor pages have no duplicates or skips", async () => {
    const lead = await makeLead();
    const base = new Date("2026-09-14T10:00:00.000Z");
    for (let i = 0; i < 5; i += 1) {
      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          activityType: "NOTE",
          occurredAt: new Date(base.getTime() + i * 1000),
          summary: `a${i}`,
        },
      });
    }
    const p1 = await listLeadTimeline(lead.id, { limit: 2 });
    const p2 = await listLeadTimeline(lead.id, { limit: 2, cursor: p1.nextCursor });
    const p3 = await listLeadTimeline(lead.id, { limit: 2, cursor: p2.nextCursor });
    const ids = [...p1.items, ...p2.items, ...p3.items].map((e) => e.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(p3.nextCursor).toBeNull();
  });

  dbIt("L concurrent write does not duplicate page-1 ids on page-2", async () => {
    const lead = await makeLead();
    const base = new Date("2026-09-14T08:00:00.000Z");
    for (let i = 0; i < 4; i += 1) {
      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          activityType: "NOTE",
          occurredAt: new Date(base.getTime() + i * 1000),
          summary: `c${i}`,
        },
      });
    }
    const p1 = await listLeadTimeline(lead.id, { limit: 2 });
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        activityType: "NOTE",
        occurredAt: new Date("2026-09-14T09:00:00.000Z"),
        summary: "concurrent-newer",
      },
    });
    const p2 = await listLeadTimeline(lead.id, { limit: 10, cursor: p1.nextCursor });
    const p1ids = new Set(p1.items.map((e) => e.id));
    expect(p2.items.every((e) => !p1ids.has(e.id))).toBe(true);
    expect(p2.items.map((e) => e.summary)).not.toContain("concurrent-newer");
  });

  dbIt("M+N attribution empty + field mapping contract", async () => {
    const lead = await makeLead();
    expect(await getLeadAttribution(lead.id)).toEqual({ firstTouch: null, lastTouch: null });
    expect(Object.keys(TOUCH_RECORD_SCHEMA_MAPPING)).toEqual([
      "source",
      "medium",
      "campaignCode",
      "term",
      "content",
      "landingPage",
      "creative",
      "referralPartner",
      "capturedAt",
    ]);
  });

  dbIt("O first-touch fields stay while last-touch can differ after a second row update", async () => {
    const lead = await makeLead();
    const t0 = new Date("2026-09-01T00:00:00.000Z");
    const t1 = new Date("2026-09-10T00:00:00.000Z");
    await prisma.leadAttribution.create({
      data: {
        leadId: lead.id,
        firstTouchAt: t0,
        firstTouchSource: LeadSource.WEB_FORM,
        firstTouchMedium: "first",
        firstTouchUtm: { term: "egg", content: "hero" },
        lastTouchAt: t0,
        lastTouchSource: LeadSource.WEB_FORM,
        lastTouchMedium: "first",
      },
    });
    await prisma.leadAttribution.update({
      where: { leadId: lead.id },
      data: {
        lastTouchAt: t1,
        lastTouchMedium: "last",
        lastTouchSource: LeadSource.WHATSAPP_BOT,
      },
    });
    const body = await getLeadAttribution(lead.id);
    expect(body.firstTouch?.medium).toBe("first");
    expect(body.firstTouch?.source).toBe("WEB_FORM");
    expect(body.firstTouch?.term).toBe("egg");
    expect(body.firstTouch?.content).toBe("hero");
    expect(body.lastTouch?.medium).toBe("last");
    expect(body.lastTouch?.source).toBe("WHATSAPP_BOT");
  });

  dbIt("R CRM status latest per target, no externalId, empty when none", async () => {
    const lead = await makeLead();
    expect(await getLeadCrmStatus(lead.id)).toEqual({ syncs: [] });
    await prisma.crmSyncQueue.create({
      data: {
        entityType: CrmEntityType.LEAD,
        entityId: lead.id,
        syncTarget: CrmSyncTarget.ZOHO,
        payload: { n: 1 },
        status: CrmSyncStatus.FAILED,
        attempts: 1,
        lastError: "boom",
        externalId: "secret-zoho",
      },
    });
    await new Promise((r) => setTimeout(r, 75));
    await prisma.crmSyncQueue.create({
      data: {
        entityType: CrmEntityType.LEAD,
        entityId: lead.id,
        syncTarget: CrmSyncTarget.ZOHO,
        payload: { n: 2 },
        status: CrmSyncStatus.SYNCED,
        attempts: 2,
        succeededAt: new Date(),
        externalId: "secret-zoho-2",
      },
    });
    await prisma.crmSyncQueue.create({
      data: {
        entityType: CrmEntityType.LEAD,
        entityId: lead.id,
        syncTarget: CrmSyncTarget.SALESFORCE,
        payload: { n: 3 },
        status: CrmSyncStatus.PENDING,
        attempts: 0,
        externalId: "secret-sf",
      },
    });
    const body = await getLeadCrmStatus(lead.id);
    expect(body.syncs.map((s) => s.target)).toEqual(["ZOHO", "SALESFORCE"]);
    expect(body.syncs[0].status).toBe("SYNCED");
    expect(JSON.stringify(body)).not.toMatch(/secret-/);
    expect(JSON.stringify(body)).not.toMatch(/externalId/);
  });

  dbIt("E command still re-checks archive independently of resolver", async () => {
    const lead = await makeLead();
    await prisma.lead.update({ where: { id: lead.id }, data: { status: LeadStatus.LOST } });
    const actor = { userId, roles: ["OPS_MANAGER"], siteId: null };
    await expect(archiveLeadV2(lead.id, actor, "try")).rejects.toThrow();
    const domain = aLead({ id: lead.id, status: LeadStatus.LOST });
    const resolved = await resolveLeadActions(domain, actor);
    expect(resolved.map((a) => a.id)).not.toContain("ARCHIVE_LEAD");
  });
});
