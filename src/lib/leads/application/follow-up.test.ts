import { describe, expect, it } from "vitest";

import { FollowUpPriority, FollowUpStatus, FollowUpType, LeadEventType } from "../domain/enums";
import { LeadOwnershipDeniedError } from "../domain/errors";
import type { ActorContext } from "../domain/ports/shared";
import { FakeClock } from "../testing/fakes/FakeClock";
import { FakeIdGenerator } from "../testing/fakes/FakeIdGenerator";
import { FakeSlaPort } from "../testing/fakes/FakeSlaPort";
import {
  cancelFollowUp,
  completeFollowUp,
  createFollowUp,
  createMemoryFollowUpStore,
  listFollowUps,
  rescheduleFollowUp,
  tickFollowUps,
} from "./follow-up";

const telecaller: ActorContext = {
  userId: "tc-1",
  roles: ["TELECALLER"],
};

const otherTelecaller: ActorContext = {
  userId: "tc-2",
  roles: ["TELECALLER"],
};

const ops: ActorContext = {
  userId: "ops-1",
  roles: ["OPS_MANAGER"],
};

function harness() {
  const clock = new FakeClock(new Date("2026-09-08T10:00:00.000Z"));
  const store = createMemoryFollowUpStore();
  const sla = new FakeSlaPort();
  const ids = new FakeIdGenerator();
  const policy = { defaultDueHours: 24, overdueGraceMinutes: 30 };
  return { clock, store, sla, ids, policy };
}

describe("LeadFollowUp lifecycle", () => {
  it("create → OPEN → DUE at dueAt → OVERDUE after grace", async () => {
    const h = harness();
    const dueAt = new Date("2026-09-08T12:00:00.000Z");
    const fu = await createFollowUp(
      {
        leadId: "lead-1",
        ownerUserId: telecaller.userId,
        actor: telecaller,
        type: FollowUpType.CALLBACK,
        dueAt,
      },
      h,
    );
    expect(fu.status).toBe(FollowUpStatus.OPEN);
    expect(h.store.activities.some((a) => a.relatedEntityId === fu.id)).toBe(true);
    expect(h.store.outbox.some((o) => o.eventType === LeadEventType.LeadFollowUpCreated)).toBe(
      true,
    );
    expect(h.sla.scheduled.some((s) => s.entityId === fu.id && s.stageKey === "FOLLOW_UP")).toBe(
      true,
    );

    h.clock.set(dueAt);
    let tick = await tickFollowUps(h);
    expect(tick.markedDue).toBe(1);
    expect(h.store.followUps[0]?.status).toBe(FollowUpStatus.DUE);

    h.clock.set(new Date(dueAt.getTime() + 30 * 60_000 + 1));
    tick = await tickFollowUps(h);
    expect(tick.markedOverdue).toBe(1);
    expect(h.store.followUps[0]?.status).toBe(FollowUpStatus.OVERDUE);
    expect(tick.slaBreaches).toBe(1);
    expect(h.store.slaBreaches[0]?.followUpId).toBe(fu.id);
  });

  it("reschedule preserves rescheduledFromId chain", async () => {
    const h = harness();
    const first = await createFollowUp(
      {
        leadId: "lead-1",
        ownerUserId: telecaller.userId,
        actor: telecaller,
        dueAt: new Date("2026-09-08T12:00:00.000Z"),
      },
      h,
    );
    const { previous, next } = await rescheduleFollowUp(
      {
        followUpId: first.id,
        actor: telecaller,
        dueAt: new Date("2026-09-09T12:00:00.000Z"),
      },
      h,
    );
    expect(previous.status).toBe(FollowUpStatus.RESCHEDULED);
    expect(previous.nextFollowUpId).toBe(next.id);
    expect(next.rescheduledFromId).toBe(previous.id);
  });

  it("complete atomically appends LeadActivity + LeadFollowUpCompleted", async () => {
    const h = harness();
    const fu = await createFollowUp(
      {
        leadId: "lead-1",
        ownerUserId: telecaller.userId,
        actor: telecaller,
        dueAt: new Date("2026-09-08T12:00:00.000Z"),
      },
      h,
    );
    await completeFollowUp({ followUpId: fu.id, actor: telecaller, outcome: "Reached" }, h);
    expect(h.store.followUps[0]?.status).toBe(FollowUpStatus.COMPLETED);
    expect(h.store.activities.filter((a) => a.summary?.includes("completed"))).toHaveLength(1);
    expect(
      h.store.outbox.filter((o) => o.eventType === LeadEventType.LeadFollowUpCompleted),
    ).toHaveLength(1);
    expect(h.sla.completed.some((c) => c.entityId === fu.id)).toBe(true);
  });

  it("cancel does not emit LeadFollowUpCompleted", async () => {
    const h = harness();
    const fu = await createFollowUp(
      {
        leadId: "lead-1",
        ownerUserId: telecaller.userId,
        actor: telecaller,
        dueAt: new Date("2026-09-08T12:00:00.000Z"),
      },
      h,
    );
    await cancelFollowUp({ followUpId: fu.id, actor: telecaller, reason: "Lead converted" }, h);
    expect(h.store.followUps[0]?.status).toBe(FollowUpStatus.CANCELLED);
    expect(h.store.activities.some((a) => a.summary?.includes("cancelled"))).toBe(true);
    expect(
      h.store.outbox.filter((o) => o.eventType === LeadEventType.LeadFollowUpCompleted),
    ).toHaveLength(0);
  });

  it("TELECALLER cannot edit another owner's follow-up; OPS_MANAGER can", async () => {
    const h = harness();
    const fu = await createFollowUp(
      {
        leadId: "lead-1",
        ownerUserId: telecaller.userId,
        actor: telecaller,
        dueAt: new Date("2026-09-08T12:00:00.000Z"),
      },
      h,
    );
    await expect(
      completeFollowUp({ followUpId: fu.id, actor: otherTelecaller }, h),
    ).rejects.toBeInstanceOf(LeadOwnershipDeniedError);

    await completeFollowUp({ followUpId: fu.id, actor: ops, allowAny: true }, h);
    expect(h.store.followUps[0]?.status).toBe(FollowUpStatus.COMPLETED);
  });

  it("list owner=me hides other owners", async () => {
    const h = harness();
    await createFollowUp(
      {
        leadId: "lead-1",
        ownerUserId: telecaller.userId,
        actor: telecaller,
        dueAt: new Date("2026-09-08T12:00:00.000Z"),
        priority: FollowUpPriority.HIGH,
      },
      h,
    );
    await createFollowUp(
      {
        leadId: "lead-2",
        ownerUserId: otherTelecaller.userId,
        actor: otherTelecaller,
        dueAt: new Date("2026-09-08T11:00:00.000Z"),
      },
      h,
    );
    const mine = listFollowUps({ ownerUserId: telecaller.userId, status: "queue" }, h);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.ownerUserId).toBe(telecaller.userId);
  });
});
