import { afterEach, describe, expect, it, vi } from "vitest";

import { DispatchStatus, LeadEvent, LeadEventType, LeadStatus } from "../domain/enums";
import { LEAD_EVENT_TYPES } from "../domain/events";
import type { LeadOutboxEvent } from "../domain/entities/LeadOutboxEvent";
import { aLead } from "../testing/fixtures/aLead";
import { FakeAuditPort } from "../testing/fakes/FakeAuditPort";
import { FakeNotificationPort } from "../testing/fakes/FakeNotificationPort";
import { InMemoryOutboxRepository } from "../testing/fakes/InMemoryOutboxRepository";
import { InMemoryTransitionStore } from "./testing/in-memory-transition-store";
import { applyTransition } from "./__apply-transition";
import { createAnalyticsConsumer, getOutboxCounter, resetAnalyticsCounters } from "./consumers/analytics-consumer";
import { crmOperationFor } from "./consumers/crm-consumer";
import { createNotificationConsumer } from "./consumers/notification-consumer";
import { dispatchPending } from "./outbox-dispatcher";
import {
  OUTBOX_RETRY_LADDER_MS,
  nextRetryAt,
  type OutboxConsumer,
} from "./outbox-types";
import type { GuardFacts } from "../domain/state-machine/types";

const env = { ...process.env };

afterEach(() => {
  process.env = { ...env };
  resetAnalyticsCounters();
});

const NOW = new Date("2026-09-06T12:00:00.000Z");

function anOutboxEvent(over: Partial<LeadOutboxEvent> = {}): LeadOutboxEvent {
  return {
    id: over.id ?? "evt-1",
    aggregateType: "Lead",
    aggregateId: over.aggregateId ?? "lead-1",
    eventType: over.eventType ?? LeadEventType.LeadAssigned,
    eventVersion: 1,
    payload: over.payload ?? { assigneeUserId: "tc_1" },
    occurredAt: over.occurredAt ?? NOW,
    enqueuedAt: over.enqueuedAt ?? NOW,
    publishedAt: over.publishedAt ?? null,
    dispatchStatus: over.dispatchStatus ?? DispatchStatus.PENDING,
    attemptCount: over.attemptCount ?? 0,
    lastAttemptAt: over.lastAttemptAt ?? null,
    lastAttemptError: over.lastAttemptError ?? null,
    lockedUntil: over.lockedUntil ?? null,
    lockedByWorkerId: over.lockedByWorkerId ?? null,
  };
}

function facts(over: Partial<GuardFacts> = {}): GuardFacts {
  return {
    hasConsent: true,
    dncBlocked: false,
    isOwner: true,
    isSupervisor: true,
    hasPermission: true,
    requiredFieldsPresent: true,
    hasConversion: false,
    lostAt: new Date("2026-08-01T00:00:00.000Z"),
    isMerged: false,
    counsellorAvailable: true,
    attemptCount: 0,
    maxAttempts: 3,
    configVersionActive: true,
    callRecordAttached: true,
    dueAtPresent: true,
    reasonPresent: true,
    bookingExists: true,
    bookingInFuture: true,
    sessionRecordAttached: true,
    personTypeDonor: true,
    personTypeRecipient: true,
    recommendationRegister: true,
    leadMergeExists: true,
    retentionExpired: true,
    outcomeWon: false,
    assigneeAvailable: true,
    claimAllowed: true,
    publicIntake: true,
    ...over,
  };
}

function recordingConsumers(onCrm?: () => Promise<void> | void) {
  const order: string[] = [];
  const notifications = new FakeNotificationPort();
  const crm: OutboxConsumer = {
    name: "crm",
    async handle(event) {
      order.push(`crm:${event.id}`);
      await onCrm?.();
    },
  };
  const notification = createNotificationConsumer(notifications);
  const wrappedNotification: OutboxConsumer = {
    name: "notification",
    async handle(event, ctx) {
      order.push(`notification:${event.id}`);
      await notification.handle(event, ctx);
    },
  };
  const analytics = createAnalyticsConsumer();
  const wrappedAnalytics: OutboxConsumer = {
    name: "analytics",
    async handle(event, ctx) {
      order.push(`analytics:${event.id}`);
      await analytics.handle(event, ctx);
    },
  };
  return { order, notifications, consumers: [crm, wrappedNotification, wrappedAnalytics] };
}

describe("outbox retry ladder", () => {
  it("maps attemptCount 1..5 to 30s, 2m, 10m, 1h, 6h", () => {
    expect(OUTBOX_RETRY_LADDER_MS).toEqual([30_000, 120_000, 600_000, 3_600_000, 21_600_000]);
    expect(nextRetryAt(1, NOW).toISOString()).toBe("2026-09-06T12:00:30.000Z");
    expect(nextRetryAt(2, NOW).toISOString()).toBe("2026-09-06T12:02:00.000Z");
    expect(nextRetryAt(3, NOW).toISOString()).toBe("2026-09-06T12:10:00.000Z");
    expect(nextRetryAt(4, NOW).toISOString()).toBe("2026-09-06T13:00:00.000Z");
    expect(nextRetryAt(5, NOW).toISOString()).toBe("2026-09-06T18:00:00.000Z");
  });
});

describe("dispatchPending", () => {
  it("returns skipped:true and does not touch rows when the flag is off", async () => {
    const repo = new InMemoryOutboxRepository();
    repo.seed(anOutboxEvent());
    const summary = await dispatchPending(50, {
      enabled: false,
      repo,
      consumers: recordingConsumers().consumers,
      now: NOW,
      workerId: "w1",
    });
    expect(summary).toMatchObject({ skipped: true, claimed: 0, published: 0 });
    expect(repo.events.get("evt-1")?.dispatchStatus).toBe(DispatchStatus.PENDING);
    expect(repo.claimCalls).toBe(0);
  });

  it("publishes all 16 catalogue event types", async () => {
    const repo = new InMemoryOutboxRepository();
    for (const [i, eventType] of LEAD_EVENT_TYPES.entries()) {
      repo.seed(
        anOutboxEvent({
          id: `evt-${eventType}`,
          aggregateId: `lead-${i}`,
          eventType,
          occurredAt: new Date(NOW.getTime() + i),
          enqueuedAt: new Date(NOW.getTime() + i),
        }),
      );
    }
    const { consumers } = recordingConsumers();
    const summary = await dispatchPending(50, {
      enabled: true,
      repo,
      consumers,
      now: NOW,
      workerId: "w1",
    });
    expect(summary.published).toBe(16);
    expect(summary.claimed).toBe(16);
    for (const eventType of LEAD_EVENT_TYPES) {
      expect(repo.events.get(`evt-${eventType}`)?.dispatchStatus).toBe(DispatchStatus.PUBLISHED);
      expect(crmOperationFor(eventType)).toBeTruthy();
    }
  });

  it("preserves per-aggregate order: A then B for the same leadId", async () => {
    const repo = new InMemoryOutboxRepository();
    const tA = new Date("2026-09-06T12:00:00.000Z");
    const tB = new Date("2026-09-06T12:00:01.000Z");
    repo.seed(anOutboxEvent({ id: "A", occurredAt: tA, enqueuedAt: tA, eventType: LeadEventType.LeadCreated }));
    repo.seed(
      anOutboxEvent({
        id: "B",
        occurredAt: tB,
        enqueuedAt: tB,
        eventType: LeadEventType.LeadAssigned,
      }),
    );
    const seen: string[] = [];
    const consumers: OutboxConsumer[] = [
      {
        name: "analytics",
        async handle(event) {
          seen.push(event.id);
        },
      },
    ];
    await dispatchPending(50, { enabled: true, repo, consumers, now: NOW, workerId: "w1" });
    expect(seen).toEqual(["A"]);
    expect(repo.events.get("A")?.dispatchStatus).toBe(DispatchStatus.PUBLISHED);
    expect(repo.events.get("B")?.dispatchStatus).toBe(DispatchStatus.PENDING);
    await dispatchPending(50, { enabled: true, repo, consumers, now: NOW, workerId: "w1" });
    expect(seen).toEqual(["A", "B"]);
  });

  it("retries: transient consumer failure increments attemptCount and schedules the ladder", async () => {
    const repo = new InMemoryOutboxRepository();
    repo.seed(anOutboxEvent());
    const consumers: OutboxConsumer[] = [
      {
        name: "crm",
        async handle() {
          throw new Error("crm down");
        },
      },
    ];
    const summary = await dispatchPending(50, { enabled: true, repo, consumers, now: NOW, workerId: "w1" });
    expect(summary.failed).toBe(1);
    const row = repo.events.get("evt-1");
    expect(row?.dispatchStatus).toBe(DispatchStatus.FAILED);
    expect(row?.attemptCount).toBe(1);
    expect(row?.lastAttemptAt?.toISOString()).toBe(NOW.toISOString());
    expect(nextRetryAt(row!.attemptCount, row!.lastAttemptAt!).toISOString()).toBe(
      "2026-09-06T12:00:30.000Z",
    );

    const tooSoon = new Date(NOW.getTime() + 10_000);
    await dispatchPending(50, { enabled: true, repo, consumers, now: tooSoon, workerId: "w1" });
    expect(repo.events.get("evt-1")?.attemptCount).toBe(1);

    const due = new Date(NOW.getTime() + 30_000);
    await dispatchPending(50, { enabled: true, repo, consumers, now: due, workerId: "w2" });
    expect(repo.events.get("evt-1")?.attemptCount).toBe(2);
    expect(repo.events.get("evt-1")?.dispatchStatus).toBe(DispatchStatus.FAILED);
  });

  it("moves to DLQ and marks DEAD after 5 failures", async () => {
    const repo = new InMemoryOutboxRepository();
    repo.seed(anOutboxEvent({ attemptCount: 4, dispatchStatus: DispatchStatus.FAILED, lastAttemptAt: new Date(NOW.getTime() - 6 * 60 * 60_000) }));
    const consumers: OutboxConsumer[] = [
      { name: "crm", async handle() { throw new Error("poison"); } },
    ];
    const summary = await dispatchPending(50, { enabled: true, repo, consumers, now: NOW, workerId: "w1" });
    expect(summary.dead).toBe(1);
    expect(repo.events.get("evt-1")?.dispatchStatus).toBe(DispatchStatus.DEAD);
    expect(repo.events.get("evt-1")?.attemptCount).toBe(5);
    expect(repo.dlq).toHaveLength(1);
    expect(repo.dlq[0]?.originalEventId).toBe("evt-1");
  });

  it("isolates consumers: CRM throw still invokes notification", async () => {
    const repo = new InMemoryOutboxRepository();
    repo.seed(anOutboxEvent());
    const notifications = new FakeNotificationPort();
    const crm: OutboxConsumer = {
      name: "crm",
      async handle() {
        throw new Error("crm boom");
      },
    };
    const summary = await dispatchPending(50, {
      enabled: true,
      repo,
      consumers: [crm, createNotificationConsumer(notifications), createAnalyticsConsumer()],
      now: NOW,
      workerId: "w1",
    });
    expect(summary.failed).toBe(1);
    expect(notifications.sent).toHaveLength(1);
    expect(notifications.sent[0]?.templateKey).toBe("lead.assigned.in_app");
    expect(getOutboxCounter(LeadEventType.LeadAssigned)).toBe(1);
  });

  it("reclaims a row whose lease has expired for a different worker", async () => {
    const repo = new InMemoryOutboxRepository();
    repo.seed(
      anOutboxEvent({
        dispatchStatus: DispatchStatus.IN_FLIGHT,
        lockedUntil: new Date(NOW.getTime() - 1_000),
        lockedByWorkerId: "old-worker",
      }),
    );
    const { consumers } = recordingConsumers();
    await dispatchPending(50, { enabled: true, repo, consumers, now: NOW, workerId: "new-worker" });
    expect(repo.events.get("evt-1")?.dispatchStatus).toBe(DispatchStatus.PUBLISHED);
    expect(repo.events.get("evt-1")?.lockedByWorkerId).toBeNull();
  });

  it("two workers claim different rows with no double-processing", async () => {
    const repo = new InMemoryOutboxRepository();
    repo.seed(anOutboxEvent({ id: "e1", aggregateId: "lead-a" }));
    repo.seed(anOutboxEvent({ id: "e2", aggregateId: "lead-b", occurredAt: new Date(NOW.getTime() + 1) }));
    const processed: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const consumers: OutboxConsumer[] = [
      {
        name: "analytics",
        async handle(event) {
          processed.push(event.id);
          await gate;
        },
      },
    ];
    const p1 = dispatchPending(1, { enabled: true, repo, consumers, now: NOW, workerId: "w1" });
    await vi.waitFor(() => expect(processed).toHaveLength(1));
    const p2 = dispatchPending(1, { enabled: true, repo, consumers, now: NOW, workerId: "w2" });
    await vi.waitFor(() => expect(processed).toHaveLength(2));
    release();
    const [s1, s2] = await Promise.all([p1, p2]);
    expect(s1.claimed + s2.claimed).toBe(2);
    expect(s1.published + s2.published).toBe(2);
    expect(new Set(processed).size).toBe(2);
    expect(repo.events.get("e1")?.dispatchStatus).toBe(DispatchStatus.PUBLISHED);
    expect(repo.events.get("e2")?.dispatchStatus).toBe(DispatchStatus.PUBLISHED);
  });
});

describe("atomicity with domain writes", () => {
  it("rolls back lead status and outbox when persist throws after outbox insert", async () => {
    process.env.LEAD_STATE_MACHINE_ENABLED = "on";
    const store = new InMemoryTransitionStore();
    store.throwAfterWrites = true;
    const lead = aLead({ status: LeadStatus.NEW });
    store.seed(lead);
    await expect(
      applyTransition(
        { store, audit: new FakeAuditPort() },
        {
          leadId: lead.id,
          event: LeadEvent.assign,
          actor: { userId: "u1", roles: ["OPS_MANAGER"] },
          payload: { assigneeUserId: "tc_1" },
          facts: facts(),
        },
      ),
    ).rejects.toThrow("mid-transition failure");
    expect((await store.load(lead.id))?.status).toBe(LeadStatus.NEW);
    expect(store.outbox.filter((o) => o.leadId === lead.id)).toHaveLength(0);
  });

  it("simulates Prisma interactive-tx rollback of domain + outbox", async () => {
    const leadUpdates: string[] = [];
    const outboxInserts: string[] = [];
    let committed = false;
    const tx = {
      lead: {
        update: vi.fn(async () => {
          leadUpdates.push("status");
        }),
      },
      leadOutboxEvent: {
        create: vi.fn(async () => {
          outboxInserts.push("LeadAssigned");
          return { id: "o1" };
        }),
      },
    };
    async function runBundle(throwAfterWrites: boolean) {
      committed = false;
      leadUpdates.length = 0;
      outboxInserts.length = 0;
      try {
        await tx.lead.update();
        await tx.leadOutboxEvent.create();
        if (throwAfterWrites) throw new Error("boom after outbox");
        committed = true;
      } catch (err) {
        leadUpdates.length = 0;
        outboxInserts.length = 0;
        throw err;
      }
    }
    await expect(runBundle(true)).rejects.toThrow("boom after outbox");
    expect(committed).toBe(false);
    expect(leadUpdates).toHaveLength(0);
    expect(outboxInserts).toHaveLength(0);
    await runBundle(false);
    expect(committed).toBe(true);
    expect(leadUpdates).toEqual(["status"]);
    expect(outboxInserts).toEqual(["LeadAssigned"]);
  });
});
