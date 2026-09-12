import type { LeadActivity } from "../domain/entities/LeadActivity";
import type { LeadFollowUp } from "../domain/entities/LeadFollowUp";
import {
  FollowUpPriority,
  FollowUpStatus,
  FollowUpType,
  LeadActivityType,
  LeadEventType,
} from "../domain/enums";
import type {
  FollowUpPriority as FollowUpPriorityT,
  FollowUpStatus as FollowUpStatusT,
  FollowUpType as FollowUpTypeT,
} from "../domain/enums";
import { LeadInvariantViolationError, LeadOwnershipDeniedError } from "../domain/errors";
import type { ActorContext } from "../domain/ports/shared";
import type { Clock } from "../domain/ports/Clock";
import type { IdGenerator } from "../domain/ports/IdGenerator";
import type { SlaPort } from "../domain/ports/SlaPort";
import { followUpToDomain, type PrismaFollowUpRow } from "../adapters/mappers/follow-up-mapper";
import { DEFAULT_FOLLOW_UP_POLICY } from "../config/defaults";
import { CONFIG_KEYS } from "../config/keys";
import { FakeClock } from "../testing/fakes/FakeClock";
import { FakeIdGenerator } from "../testing/fakes/FakeIdGenerator";
import { FakeSlaPort } from "../testing/fakes/FakeSlaPort";
import { permissionGranted, permissionsForRoles } from "@/lib/rbac-permissions";

const TERMINAL: ReadonlySet<FollowUpStatusT> = new Set([
  FollowUpStatus.COMPLETED,
  FollowUpStatus.CANCELLED,
  FollowUpStatus.RESCHEDULED,
]);

const OPEN_QUEUE: FollowUpStatusT[] = [
  FollowUpStatus.OPEN,
  FollowUpStatus.DUE,
  FollowUpStatus.OVERDUE,
];

export type FollowUpPolicy = {
  defaultDueHours: number;
  overdueGraceMinutes?: number;
};

export type ActivityRow = {
  id: string;
  leadId: string;
  activityType: string;
  summary: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  actorUserId: string | null;
  occurredAt: Date;
};

export type OutboxRow = {
  id: string;
  leadId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

export type SlaBreachRow = {
  followUpId: string;
  slaScheduleId: string;
  leadId: string;
};

export type FollowUpStore = {
  followUps: LeadFollowUp[];
  activities: ActivityRow[];
  outbox: OutboxRow[];
  slaBreaches: SlaBreachRow[];
};

export function canOverrideFollowUp(roles: readonly string[]): boolean {
  return permissionGranted(permissionsForRoles(roles), "follow_up.update.any");
}

export function assertFollowUpAccess(
  row: LeadFollowUp,
  actor: ActorContext,
  mode: "own" | "any",
): void {
  if (mode === "any" || canOverrideFollowUp(actor.roles)) return;
  if (row.ownerUserId !== actor.userId) {
    throw new LeadOwnershipDeniedError("Follow-up is outside owner scope", {
      followUpId: row.id,
      ownerUserId: row.ownerUserId,
      userId: actor.userId,
    });
  }
}

function hoursUntil(from: Date, to: Date): number {
  return Math.max(1 / 60, (to.getTime() - from.getTime()) / 3_600_000);
}

export function createMemoryFollowUpStore(): FollowUpStore {
  return { followUps: [], activities: [], outbox: [], slaBreaches: [] };
}

export type FollowUpDeps = {
  store: FollowUpStore;
  clock: Clock;
  ids: IdGenerator;
  sla: SlaPort;
  policy: FollowUpPolicy;
  persistPrisma?: boolean;
};

function defaultDeps(partial?: Partial<FollowUpDeps>): FollowUpDeps {
  return {
    store: partial?.store ?? createMemoryFollowUpStore(),
    clock: partial?.clock ?? new FakeClock(),
    ids: partial?.ids ?? new FakeIdGenerator(),
    sla: partial?.sla ?? new FakeSlaPort(),
    policy: partial?.policy ?? DEFAULT_FOLLOW_UP_POLICY,
    persistPrisma: partial?.persistPrisma,
  };
}

function requireOpen(row: LeadFollowUp, action: string): void {
  if (TERMINAL.has(row.status)) {
    throw new LeadInvariantViolationError(`Cannot ${action} a ${row.status} follow-up`, {
      followUpId: row.id,
      status: row.status,
    });
  }
}

function pushActivity(
  deps: FollowUpDeps,
  input: {
    leadId: string;
    summary: string;
    relatedEntityId: string;
    actorUserId: string | null;
    outcome?: string | null;
  },
): ActivityRow {
  const row: ActivityRow = {
    id: deps.ids.next(),
    leadId: input.leadId,
    activityType: LeadActivityType.FOLLOW_UP,
    summary: input.summary,
    relatedEntityType: "LeadFollowUp",
    relatedEntityId: input.relatedEntityId,
    actorUserId: input.actorUserId,
    occurredAt: deps.clock.now(),
  };
  deps.store.activities.push(row);
  return row;
}

function pushOutbox(
  deps: FollowUpDeps,
  leadId: string,
  eventType: string,
  payload: Record<string, unknown>,
): OutboxRow {
  const row: OutboxRow = {
    id: deps.ids.next(),
    leadId,
    eventType,
    payload,
  };
  deps.store.outbox.push(row);
  return row;
}

export type CreateFollowUpInput = {
  leadId: string;
  ownerUserId: string;
  actor: ActorContext;
  type?: FollowUpTypeT;
  priority?: FollowUpPriorityT;
  reason?: string | null;
  dueAt: Date;
  emitOutbox?: boolean;
};

export async function createFollowUp(
  input: CreateFollowUpInput,
  deps?: Partial<FollowUpDeps>,
): Promise<LeadFollowUp> {
  const d = defaultDeps(deps);
  const now = d.clock.now();
  const id = d.ids.next();
  const slaScheduleId = await d.sla.schedule({
    entityType: "LeadFollowUp",
    entityId: id,
    stageKey: "FOLLOW_UP",
    startAt: now,
  });
  const row: LeadFollowUp = {
    id,
    leadId: input.leadId,
    ownerUserId: input.ownerUserId,
    type: input.type ?? FollowUpType.CALLBACK,
    priority: input.priority ?? FollowUpPriority.NORMAL,
    reason: input.reason ?? null,
    dueAt: input.dueAt,
    status: FollowUpStatus.OPEN,
    completedAt: null,
    completedByUserId: null,
    outcome: null,
    nextFollowUpId: null,
    rescheduledFromId: null,
    cancelReason: null,
    slaScheduleId,
    createdAt: now,
    updatedAt: now,
  };
  d.store.followUps.push(row);
  pushActivity(d, {
    leadId: input.leadId,
    summary: "FOLLOW_UP created",
    relatedEntityId: id,
    actorUserId: input.actor.userId,
  });
  if (input.emitOutbox !== false) {
    pushOutbox(d, input.leadId, LeadEventType.LeadFollowUpCreated, {
      followUpId: id,
      type: row.type,
      dueAt: row.dueAt.toISOString(),
    });
  }
  if (d.persistPrisma) {
    await persistCreatePrisma(row, input.actor, now, input.emitOutbox !== false);
  }
  return row;
}

export type CompleteFollowUpInput = {
  followUpId: string;
  actor: ActorContext;
  outcome?: string | null;
  allowAny?: boolean;
};

export async function completeFollowUp(
  input: CompleteFollowUpInput,
  deps?: Partial<FollowUpDeps>,
): Promise<LeadFollowUp> {
  const d = defaultDeps(deps);
  const row = requireRow(d, input.followUpId);
  assertFollowUpAccess(row, input.actor, input.allowAny ? "any" : "own");
  requireOpen(row, "complete");
  const now = d.clock.now();
  row.status = FollowUpStatus.COMPLETED;
  row.completedAt = now;
  row.completedByUserId = input.actor.userId;
  row.outcome = input.outcome ?? row.outcome;
  row.updatedAt = now;
  pushActivity(d, {
    leadId: row.leadId,
    summary: "FOLLOW_UP completed",
    relatedEntityId: row.id,
    actorUserId: input.actor.userId,
    outcome: input.outcome ?? null,
  });
  pushOutbox(d, row.leadId, LeadEventType.LeadFollowUpCompleted, {
    followUpId: row.id,
  });
  if (row.slaScheduleId) {
    await d.sla.complete("LeadFollowUp", row.id, "FOLLOW_UP");
  }
  if (d.persistPrisma) {
    await persistCompletePrisma(row, input.actor, now);
  }
  return row;
}

export type CancelFollowUpInput = {
  followUpId: string;
  actor: ActorContext;
  reason: string;
  allowAny?: boolean;
};

export async function cancelFollowUp(
  input: CancelFollowUpInput,
  deps?: Partial<FollowUpDeps>,
): Promise<LeadFollowUp> {
  const d = defaultDeps(deps);
  const row = requireRow(d, input.followUpId);
  assertFollowUpAccess(row, input.actor, input.allowAny ? "any" : "own");
  requireOpen(row, "cancel");
  const now = d.clock.now();
  row.status = FollowUpStatus.CANCELLED;
  row.cancelReason = input.reason;
  row.updatedAt = now;
  pushActivity(d, {
    leadId: row.leadId,
    summary: "FOLLOW_UP cancelled",
    relatedEntityId: row.id,
    actorUserId: input.actor.userId,
    outcome: input.reason,
  });
  if (row.slaScheduleId) {
    await d.sla.complete("LeadFollowUp", row.id, "FOLLOW_UP");
  }
  if (d.persistPrisma) {
    await persistCancelPrisma(row, input.actor, now);
  }
  return row;
}

export type RescheduleFollowUpInput = {
  followUpId: string;
  actor: ActorContext;
  dueAt: Date;
  reason?: string | null;
  allowAny?: boolean;
};

export async function rescheduleFollowUp(
  input: RescheduleFollowUpInput,
  deps?: Partial<FollowUpDeps>,
): Promise<{ previous: LeadFollowUp; next: LeadFollowUp }> {
  const d = defaultDeps(deps);
  const previous = requireRow(d, input.followUpId);
  assertFollowUpAccess(previous, input.actor, input.allowAny ? "any" : "own");
  requireOpen(previous, "reschedule");
  const now = d.clock.now();
  if (previous.slaScheduleId) {
    await d.sla.complete("LeadFollowUp", previous.id, "FOLLOW_UP");
  }
  const next = await createFollowUp(
    {
      leadId: previous.leadId,
      ownerUserId: previous.ownerUserId,
      actor: input.actor,
      type: previous.type,
      priority: previous.priority,
      reason: input.reason ?? previous.reason,
      dueAt: input.dueAt,
    },
    d,
  );
  next.rescheduledFromId = previous.id;
  previous.status = FollowUpStatus.RESCHEDULED;
  previous.nextFollowUpId = next.id;
  previous.updatedAt = now;
  if (d.persistPrisma) {
    await persistReschedulePrisma(previous, next);
  }
  return { previous, next };
}

export type PatchFollowUpInput = {
  followUpId: string;
  actor: ActorContext;
  reason?: string | null;
  priority?: FollowUpPriorityT;
  dueAt?: Date;
  allowAny?: boolean;
};

export async function patchFollowUp(
  input: PatchFollowUpInput,
  deps?: Partial<FollowUpDeps>,
): Promise<LeadFollowUp> {
  const d = defaultDeps(deps);
  const row = requireRow(d, input.followUpId);
  assertFollowUpAccess(row, input.actor, input.allowAny ? "any" : "own");
  requireOpen(row, "update");
  if (input.reason !== undefined) row.reason = input.reason;
  if (input.priority) row.priority = input.priority;
  if (input.dueAt) {
    row.dueAt = input.dueAt;
    if (input.dueAt.getTime() > d.clock.now().getTime()) {
      row.status = FollowUpStatus.OPEN;
    }
  }
  row.updatedAt = d.clock.now();
  if (d.persistPrisma) {
    await persistPatchPrisma(row);
  }
  return row;
}

export type ListFollowUpsFilter = {
  ownerUserId?: string;
  status?: FollowUpStatusT | "due" | "queue";
  dueBefore?: Date;
  dueAfter?: Date;
  leadId?: string;
};

export function listFollowUps(
  filter: ListFollowUpsFilter,
  deps?: Partial<FollowUpDeps>,
): LeadFollowUp[] {
  const d = defaultDeps(deps);
  return d.store.followUps
    .filter((row) => {
      if (filter.ownerUserId && row.ownerUserId !== filter.ownerUserId) return false;
      if (filter.leadId && row.leadId !== filter.leadId) return false;
      if (filter.status === "due") {
        if (row.status !== FollowUpStatus.DUE && row.status !== FollowUpStatus.OVERDUE) {
          return false;
        }
      } else if (filter.status === "queue") {
        if (!OPEN_QUEUE.includes(row.status)) return false;
      } else if (filter.status && row.status !== filter.status) {
        return false;
      }
      if (filter.dueBefore && row.dueAt.getTime() > filter.dueBefore.getTime()) return false;
      if (filter.dueAfter && row.dueAt.getTime() < filter.dueAfter.getTime()) return false;
      return true;
    })
    .sort((a, b) => {
      const p = priorityRank(a.priority) - priorityRank(b.priority);
      if (p !== 0) return p;
      return a.dueAt.getTime() - b.dueAt.getTime();
    });
}

function priorityRank(p: FollowUpPriorityT): number {
  if (p === FollowUpPriority.URGENT) return 0;
  if (p === FollowUpPriority.HIGH) return 1;
  if (p === FollowUpPriority.NORMAL) return 2;
  return 3;
}

export type TickFollowUpsResult = {
  markedDue: number;
  markedOverdue: number;
  slaBreaches: number;
};

export async function tickFollowUps(
  deps?: Partial<FollowUpDeps>,
): Promise<TickFollowUpsResult> {
  const d = defaultDeps(deps);
  const now = d.clock.now();
  const graceMs = (d.policy.overdueGraceMinutes ?? 0) * 60_000;
  let markedDue = 0;
  let markedOverdue = 0;
  let slaBreaches = 0;

  for (const row of d.store.followUps) {
    if (row.status === FollowUpStatus.OPEN && row.dueAt.getTime() <= now.getTime()) {
      row.status = FollowUpStatus.DUE;
      row.updatedAt = now;
      markedDue += 1;
    }
  }
  for (const row of d.store.followUps) {
    if (
      (row.status === FollowUpStatus.DUE || row.status === FollowUpStatus.OPEN) &&
      now.getTime() > row.dueAt.getTime() + graceMs
    ) {
      row.status = FollowUpStatus.OVERDUE;
      row.updatedAt = now;
      markedOverdue += 1;
      if (row.slaScheduleId) {
        d.store.slaBreaches.push({
          followUpId: row.id,
          slaScheduleId: row.slaScheduleId,
          leadId: row.leadId,
        });
        slaBreaches += 1;
      }
    }
  }
  if (d.persistPrisma) {
    const prismaTick = await tickFollowUpsPrisma(now, graceMs);
    return prismaTick;
  }
  return { markedDue, markedOverdue, slaBreaches };
}

function requireRow(deps: FollowUpDeps, id: string): LeadFollowUp {
  const row = deps.store.followUps.find((f) => f.id === id);
  if (!row) {
    throw new LeadInvariantViolationError("Follow-up not found", { followUpId: id });
  }
  return row;
}

export function serializeFollowUp(row: LeadFollowUp) {
  return {
    id: row.id,
    leadId: row.leadId,
    ownerUserId: row.ownerUserId,
    type: row.type,
    priority: row.priority,
    reason: row.reason,
    dueAt: row.dueAt.toISOString(),
    status: row.status,
    completedAt: row.completedAt?.toISOString() ?? null,
    completedByUserId: row.completedByUserId,
    outcome: row.outcome,
    nextFollowUpId: row.nextFollowUpId,
    rescheduledFromId: row.rescheduledFromId,
    cancelReason: row.cancelReason,
    slaScheduleId: row.slaScheduleId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function loadFollowUpPolicy(): Promise<FollowUpPolicy> {
  const { prisma } = await import("@/lib/db");
  const { getConfigStoreAdapter } = await import("@/lib/leads/adapters/config-store-adapter");
  const { resolveConfigPayload } = await import("./config-store");
  return resolveConfigPayload(
    getConfigStoreAdapter(prisma),
    CONFIG_KEYS.FOLLOW_UP_POLICY_V1,
    DEFAULT_FOLLOW_UP_POLICY,
  );
}

export async function liveFollowUpDeps(): Promise<FollowUpDeps> {
  return {
    store: createMemoryFollowUpStore(),
    clock: { now: () => new Date() },
    ids: { next: () => crypto.randomUUID() },
    sla: prismaSlaPort(),
    policy: await loadFollowUpPolicy(),
    persistPrisma: true,
  };
}

export async function withLiveFollowUp(id: string): Promise<{ deps: FollowUpDeps; row: LeadFollowUp }> {
  const deps = await liveFollowUpDeps();
  const row = await loadFollowUpById(id);
  if (!row) {
    throw new LeadInvariantViolationError("Follow-up not found", { followUpId: id });
  }
  deps.store.followUps.push(row);
  return { deps, row };
}

export function prismaSlaPort(): SlaPort {
  return {
    async schedule(request) {
      const { scheduleSla } = await import("@/lib/sla/engine");
      const { SlaEntityType } = await import("@prisma/client");
      const hours = 24;
      return scheduleSla(request.entityId, SlaEntityType.LEAD_RESPONSE, "FOLLOW_UP", request.startAt, {
        entityType: SlaEntityType.LEAD_RESPONSE,
        stageKey: "FOLLOW_UP",
        responseHours: hours,
        completeHours: hours,
        escalationLadder: [{ atPct: 100, notifyRole: "OPS_MANAGER" }],
      });
    },
    async complete(_entityType, entityId, stageKey) {
      const { markCompletedByEntity } = await import("@/lib/sla/engine");
      const { SlaEntityType } = await import("@prisma/client");
      await markCompletedByEntity(SlaEntityType.LEAD_RESPONSE, entityId, stageKey ?? "FOLLOW_UP");
    },
  };
}

async function persistCreatePrisma(
  row: LeadFollowUp,
  actor: ActorContext,
  now: Date,
  emitOutbox: boolean,
): Promise<void> {
  const { prisma } = await import("@/lib/db");
  const { LeadActivityType: A, LeadChannel: C, LeadEventType: E, DispatchStatus: D } =
    await import("@prisma/client");
  await prisma.$transaction(async (tx) => {
    await tx.leadFollowUp.create({
      data: {
        id: row.id,
        leadId: row.leadId,
        ownerUserId: row.ownerUserId,
        type: row.type as never,
        priority: row.priority as never,
        reason: row.reason,
        dueAt: row.dueAt,
        status: row.status as never,
        slaScheduleId: row.slaScheduleId,
        createdAt: now,
        updatedAt: now,
      },
    });
    await tx.leadActivity.create({
      data: {
        leadId: row.leadId,
        activityType: A.FOLLOW_UP,
        channel: C.SYSTEM,
        actorUserId: actor.userId,
        actorRole: actor.roles[0] ?? null,
        occurredAt: now,
        summary: "FOLLOW_UP created",
        relatedEntityType: "LeadFollowUp",
        relatedEntityId: row.id,
      },
    });
    if (emitOutbox) {
      await tx.leadOutboxEvent.create({
        data: {
          aggregateType: "Lead",
          aggregateId: row.leadId,
          eventType: E.LeadFollowUpCreated,
          eventVersion: 1,
          payload: { followUpId: row.id, type: row.type, dueAt: row.dueAt.toISOString() },
          occurredAt: now,
          dispatchStatus: D.PENDING,
        },
      });
    }
  });
}

async function persistCompletePrisma(row: LeadFollowUp, actor: ActorContext, now: Date): Promise<void> {
  const { prisma } = await import("@/lib/db");
  const { FollowUpStatus: S, LeadActivityType: A, LeadChannel: C, LeadEventType: E, DispatchStatus: D } =
    await import("@prisma/client");
  await prisma.$transaction(async (tx) => {
    await tx.leadFollowUp.update({
      where: { id: row.id },
      data: {
        status: S.COMPLETED,
        completedAt: now,
        completedByUserId: actor.userId,
        outcome: row.outcome,
        updatedAt: now,
      },
    });
    await tx.leadActivity.create({
      data: {
        leadId: row.leadId,
        activityType: A.FOLLOW_UP,
        channel: C.SYSTEM,
        actorUserId: actor.userId,
        actorRole: actor.roles[0] ?? null,
        occurredAt: now,
        summary: "FOLLOW_UP completed",
        outcome: row.outcome,
        relatedEntityType: "LeadFollowUp",
        relatedEntityId: row.id,
      },
    });
    await tx.leadOutboxEvent.create({
      data: {
        aggregateType: "Lead",
        aggregateId: row.leadId,
        eventType: E.LeadFollowUpCompleted,
        eventVersion: 1,
        payload: { followUpId: row.id },
        occurredAt: now,
        dispatchStatus: D.PENDING,
      },
    });
  });
}

async function persistCancelPrisma(row: LeadFollowUp, actor: ActorContext, now: Date): Promise<void> {
  const { prisma } = await import("@/lib/db");
  const { FollowUpStatus: S, LeadActivityType: A, LeadChannel: C } = await import("@prisma/client");
  await prisma.$transaction(async (tx) => {
    await tx.leadFollowUp.update({
      where: { id: row.id },
      data: {
        status: S.CANCELLED,
        cancelReason: row.cancelReason,
        updatedAt: now,
      },
    });
    await tx.leadActivity.create({
      data: {
        leadId: row.leadId,
        activityType: A.FOLLOW_UP,
        channel: C.SYSTEM,
        actorUserId: actor.userId,
        actorRole: actor.roles[0] ?? null,
        occurredAt: now,
        summary: "FOLLOW_UP cancelled",
        outcome: row.cancelReason,
        relatedEntityType: "LeadFollowUp",
        relatedEntityId: row.id,
      },
    });
  });
}

async function persistReschedulePrisma(previous: LeadFollowUp, next: LeadFollowUp): Promise<void> {
  const { prisma } = await import("@/lib/db");
  const { FollowUpStatus: S } = await import("@prisma/client");
  await prisma.leadFollowUp.update({
    where: { id: previous.id },
    data: {
      status: S.RESCHEDULED,
      nextFollowUpId: next.id,
    },
  });
  await prisma.leadFollowUp.update({
    where: { id: next.id },
    data: { rescheduledFromId: previous.id },
  });
}

async function persistPatchPrisma(row: LeadFollowUp): Promise<void> {
  const { prisma } = await import("@/lib/db");
  await prisma.leadFollowUp.update({
    where: { id: row.id },
    data: {
      reason: row.reason,
      priority: row.priority as never,
      dueAt: row.dueAt,
      status: row.status as never,
    },
  });
}

async function tickFollowUpsPrisma(now: Date, graceMs: number): Promise<TickFollowUpsResult> {
  const { prisma } = await import("@/lib/db");
  const { FollowUpStatus: S, SlaStatus } = await import("@prisma/client");
  const { audit } = await import("@/lib/audit");
  const open = await prisma.leadFollowUp.findMany({
    where: { status: { in: [S.OPEN, S.DUE] } },
  });
  let markedDue = 0;
  let markedOverdue = 0;
  let slaBreaches = 0;
  for (const row of open) {
    if (row.status === S.OPEN && row.dueAt.getTime() <= now.getTime()) {
      await prisma.leadFollowUp.update({
        where: { id: row.id },
        data: { status: S.DUE },
      });
      markedDue += 1;
      row.status = S.DUE;
    }
    if (
      (row.status === S.DUE || row.status === S.OPEN) &&
      now.getTime() > row.dueAt.getTime() + graceMs
    ) {
      await prisma.leadFollowUp.update({
        where: { id: row.id },
        data: { status: S.OVERDUE },
      });
      markedOverdue += 1;
      if (row.slaScheduleId) {
        await prisma.slaSchedule.updateMany({
          where: { id: row.slaScheduleId, status: { not: SlaStatus.COMPLETED } },
          data: { status: SlaStatus.BREACHED },
        });
        await audit.log({
          actorUserId: null,
          action: "sla.breached",
          entityType: "SlaSchedule",
          entityId: row.slaScheduleId,
          afterJson: { followUpId: row.id, stageKey: "FOLLOW_UP" },
        });
        slaBreaches += 1;
      }
    }
  }
  return { markedDue, markedOverdue, slaBreaches };
}

export async function loadFollowUpById(id: string): Promise<LeadFollowUp | null> {
  const { prisma } = await import("@/lib/db");
  const row = await prisma.leadFollowUp.findUnique({ where: { id } });
  return row ? followUpToDomain(row as PrismaFollowUpRow) : null;
}

export async function listFollowUpsPrisma(filter: ListFollowUpsFilter): Promise<LeadFollowUp[]> {
  const { prisma } = await import("@/lib/db");
  const { FollowUpStatus: S } = await import("@prisma/client");
  let statusFilter: unknown = undefined;
  if (filter.status === "due") {
    statusFilter = { in: [S.DUE, S.OVERDUE] };
  } else if (filter.status === "queue") {
    statusFilter = { in: [S.OPEN, S.DUE, S.OVERDUE] };
  } else if (filter.status) {
    statusFilter = filter.status;
  }
  const rows = await prisma.leadFollowUp.findMany({
    where: {
      ...(filter.ownerUserId ? { ownerUserId: filter.ownerUserId } : {}),
      ...(filter.leadId ? { leadId: filter.leadId } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(filter.dueBefore || filter.dueAfter
        ? {
            dueAt: {
              ...(filter.dueAfter ? { gte: filter.dueAfter } : {}),
              ...(filter.dueBefore ? { lte: filter.dueBefore } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ priority: "asc" }, { dueAt: "asc" }],
    take: 200,
  });
  return rows.map((r) => followUpToDomain(r as PrismaFollowUpRow));
}

export function activityFromStore(row: ActivityRow): Pick<LeadActivity, "id" | "leadId" | "activityType"> {
  return {
    id: row.id,
    leadId: row.leadId,
    activityType: row.activityType as LeadActivity["activityType"],
  };
}

export { hoursUntil };
