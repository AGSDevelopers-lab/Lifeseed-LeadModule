import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DispatchStatus,
  LeadEventType,
  LeadPersonType,
  LeadSource,
  LeadStatus,
  PrismaClient,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadEnv } from "vite";

vi.mock("server-only", () => ({}));

import { convertDonorStub, convertRecipientStub } from "./commands";
import { enqueueCrmSyncFromOutbox } from "./consumers/crm-consumer";
import { discardCrmDlqJob, republishCrmDlqJob, retryCrmSyncJob, runCrmSyncQueue } from "./crm-sync";
import { emitLeadScoreChanged } from "./score-events";
import { t01Intake } from "../domain/state-machine/transitions";
import { prismaTransitionStore } from "../adapters/prisma-transition-store";
import { prismaLeadRepository } from "../adapters/prisma-lead-repository";
import { buildGuardFacts } from "./guard-facts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const loaded = loadEnv("", root, "");
const DATABASE_URL = process.env.DATABASE_URL ?? loaded.DATABASE_URL;
const MARKER = "b16-crm-20990914";
let codeSeq = 0;

describe.skipIf(!DATABASE_URL)("B16 conversion + CRM canonical path (Postgres)", () => {
  const dbIt = (name: string, fn: () => Promise<void>) => it(name, fn, 60_000);
  const prisma = new PrismaClient();
  let userId = "";
  const actor = {
    userId: "",
    roles: ["OPS_MANAGER", "BANK_SUPER_ADMIN"],
    siteId: null as string | null,
  };

  async function cleanup() {
    const leads = await prisma.lead.findMany({
      where: { OR: [{ fullName: MARKER }, { leadCode: { startsWith: "LED-KOL-20990914-" } }] },
      select: { id: true },
    });
    const ids = leads.map((l) => l.id);
    if (ids.length === 0) return;
    await prisma.crmSyncQueue.deleteMany({
      where: { OR: [{ entityId: { in: ids } }, { outboxEventId: { in: await outboxIds(ids) } }] },
    });
    await prisma.leadActivity.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.leadStatusHistory.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.leadScore.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.leadOutboxEvent.deleteMany({ where: { aggregateId: { in: ids } } });
    await prisma.recipient.deleteMany({ where: { sourceLeadId: { in: ids } } });
    await prisma.lead.deleteMany({ where: { id: { in: ids } } });
  }

  async function outboxIds(leadIds: string[]) {
    const rows = await prisma.leadOutboxEvent.findMany({
      where: { aggregateId: { in: leadIds } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  beforeAll(async () => {
    process.env.LEAD_STATE_MACHINE_ENABLED = "off";
    process.env.LEAD_CONVERSION_PORT_ENABLED = "off";
    process.env.CRM_SYNC_ENABLED = "false";
    process.env.CRM_SYNC_ZOHO_ENABLED = "false";
    const user = await prisma.user.findFirst({ select: { id: true } });
    if (!user) throw new Error("B16 postgres tests require a User row");
    userId = user.id;
    actor.userId = userId;
    await cleanup();
  }, 60_000);

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  }, 60_000);

  beforeEach(async () => {
    process.env.LEAD_STATE_MACHINE_ENABLED = "off";
    process.env.CRM_SYNC_ENABLED = "false";
    await cleanup();
  }, 60_000);

  async function makeLead(_seq: string, status: LeadStatus, personType: LeadPersonType) {
    codeSeq += 1;
    const n = String(codeSeq).padStart(4, "0");
    return prisma.lead.create({
      data: {
        leadCode: `LED-KOL-20990914-${n}`,
        personType,
        source: LeadSource.WEB_FORM,
        fullName: MARKER,
        phone: "9800016001",
        email: "b16@example.com",
        status,
        consentDataProcessing: true,
        consentVersion: "v1",
      },
    });
  }

  dbIt("LeadCreated persistBundle writes a real outbox row", async () => {
    const row = await makeLead("created", LeadStatus.NEW, LeadPersonType.DONOR);
    const domain = await prismaLeadRepository.byId(row.id);
    expect(domain).toBeTruthy();
    const result = t01Intake(null, {
      now: new Date(),
      actor,
      payload: { score: 10, scoreTier: "COLD", scoreBreakdown: {}, source: "WEB_FORM" },
      facts: buildGuardFacts({
        lead: domain,
        actor,
        hasPermission: true,
        hasConsent: true,
        publicIntake: true,
        requiredFieldsPresent: true,
        configVersionActive: true,
      }),
    });
    await prismaTransitionStore.persistBundle({
      lead: domain!,
      nextStatus: result.nextStatus,
      writes: result.writes,
      actorUserId: actor.userId,
      actorRole: "SYSTEM",
      now: new Date(),
    });
    const outbox = await prisma.leadOutboxEvent.findMany({
      where: { aggregateId: row.id, eventType: LeadEventType.LeadCreated },
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.dispatchStatus).toBe(DispatchStatus.PENDING);
  });

  dbIt("LeadScoreChanged emission persists in Postgres", async () => {
    const row = await makeLead("score", LeadStatus.NEW, LeadPersonType.DONOR);
    const id = await emitLeadScoreChanged({
      leadId: row.id,
      score: 55,
      tier: "WARM",
      previousScore: null,
    });
    const found = await prisma.leadOutboxEvent.findUnique({ where: { id } });
    expect(found?.eventType).toBe(LeadEventType.LeadScoreChanged);
    expect(found?.aggregateId).toBe(row.id);
  });

  dbIt("donor CONTACTED_QUALIFIED stub → CONVERTED + one LeadConverted", async () => {
    const row = await makeLead("d-cq", LeadStatus.CONTACTED_QUALIFIED, LeadPersonType.DONOR);
    await convertDonorStub(row.id, actor);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: row.id } });
    expect(lead.status).toBe(LeadStatus.CONVERTED);
    const outbox = await prisma.leadOutboxEvent.findMany({
      where: { aggregateId: row.id, eventType: LeadEventType.LeadConverted },
    });
    expect(outbox).toHaveLength(1);
  });

  dbIt("donor COUNSELLING_ATTENDED stub → CONVERTED + one LeadConverted", async () => {
    const row = await makeLead("d-ca", LeadStatus.COUNSELLING_ATTENDED, LeadPersonType.DONOR);
    await convertDonorStub(row.id, actor);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(
      LeadStatus.CONVERTED,
    );
    expect(
      await prisma.leadOutboxEvent.count({
        where: { aggregateId: row.id, eventType: LeadEventType.LeadConverted },
      }),
    ).toBe(1);
  });

  dbIt("recipient CONTACTED_QUALIFIED stub → CONVERTED + one LeadConverted", async () => {
    const row = await makeLead("r-cq", LeadStatus.CONTACTED_QUALIFIED, LeadPersonType.RECIPIENT);
    await convertRecipientStub(row.id, actor);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(
      LeadStatus.CONVERTED,
    );
    expect(
      await prisma.leadOutboxEvent.count({
        where: { aggregateId: row.id, eventType: LeadEventType.LeadConverted },
      }),
    ).toBe(1);
  });

  dbIt("recipient COUNSELLING_ATTENDED stub → CONVERTED + one LeadConverted", async () => {
    const row = await makeLead("r-ca", LeadStatus.COUNSELLING_ATTENDED, LeadPersonType.RECIPIENT);
    await convertRecipientStub(row.id, actor);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(
      LeadStatus.CONVERTED,
    );
    expect(
      await prisma.leadOutboxEvent.count({
        where: { aggregateId: row.id, eventType: LeadEventType.LeadConverted },
      }),
    ).toBe(1);
  });

  dbIt("retry after CONVERTED does not duplicate LeadConverted", async () => {
    const row = await makeLead("d-retry", LeadStatus.CONTACTED_QUALIFIED, LeadPersonType.DONOR);
    await convertDonorStub(row.id, actor);
    await expect(convertDonorStub(row.id, actor)).rejects.toThrow();
    expect(
      await prisma.leadOutboxEvent.count({
        where: { aggregateId: row.id, eventType: LeadEventType.LeadConverted },
      }),
    ).toBe(1);
  });

  dbIt("outbox → CrmSyncQueue idempotent enqueue + worker idles when flag off", async () => {
    const row = await makeLead("q1", LeadStatus.NEW, LeadPersonType.DONOR);
    const outbox = await prisma.leadOutboxEvent.create({
      data: {
        aggregateType: "Lead",
        aggregateId: row.id,
        eventType: LeadEventType.LeadCreated,
        eventVersion: 1,
        payload: { status: "NEW" },
        occurredAt: new Date(),
        dispatchStatus: DispatchStatus.PENDING,
      },
    });
    const event = {
      id: outbox.id,
      aggregateType: "Lead" as const,
      aggregateId: row.id,
      eventType: LeadEventType.LeadCreated,
      eventVersion: 1,
      payload: { status: "NEW" },
      occurredAt: outbox.occurredAt,
      enqueuedAt: outbox.enqueuedAt,
      publishedAt: null,
      dispatchStatus: outbox.dispatchStatus,
      attemptCount: 0,
      lastAttemptAt: null,
      lastAttemptError: null,
      lockedUntil: null,
      lockedByWorkerId: null,
    };
    await enqueueCrmSyncFromOutbox(event);
    await enqueueCrmSyncFromOutbox(event);
    expect(await prisma.crmSyncQueue.count({ where: { outboxEventId: outbox.id } })).toBe(1);
    process.env.CRM_SYNC_ENABLED = "false";
    const summary = await runCrmSyncQueue();
    expect(summary.idle).toBe(true);
    expect(summary.synced).toBe(0);
    const job = await prisma.crmSyncQueue.findFirstOrThrow({ where: { outboxEventId: outbox.id } });
    await retryCrmSyncJob(job.id);
    await republishCrmDlqJob(job.id);
    await discardCrmDlqJob(job.id);
    expect((await prisma.crmSyncQueue.findUniqueOrThrow({ where: { id: job.id } })).status).toBe(
      "SKIPPED",
    );
  });
});
