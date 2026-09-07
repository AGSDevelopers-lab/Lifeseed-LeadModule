import {
  SlaEntityType,
  SlaStatus,
  type Prisma,
} from "@prisma/client";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getConfigStoreAdapter } from "@/lib/leads/adapters/config-store-adapter";
import { resolveConfigPayload } from "@/lib/leads/application/config-store";
import { DEFAULT_SLA_MATRIX } from "@/lib/leads/config/defaults";
import { CONFIG_KEYS } from "@/lib/leads/config/keys";
import {
  ladderToJson,
  SLA_DEFINITIONS,
  type EscalationStep,
  type SlaScheduleDefinition,
} from "@/lib/sla/definitions";

export { defineSla } from "@/lib/sla/definitions";

function addHours(from: Date, hours: number): Date {
  const d = new Date(from);
  d.setUTCHours(d.getUTCHours() + hours);
  return d;
}

async function overlayLeadSla(def: SlaScheduleDefinition): Promise<SlaScheduleDefinition> {
  if (def.entityType !== SlaEntityType.LEAD_RESPONSE) return def;
  const matrix = await resolveConfigPayload(
    getConfigStoreAdapter(prisma),
    CONFIG_KEYS.SLA_MATRIX_V1,
    DEFAULT_SLA_MATRIX,
  );
  const tier =
    def.stageKey.includes("hot")
      ? "HOT"
      : def.stageKey.includes("warm")
        ? "WARM"
        : "COLD";
  const row = matrix[tier];
  return {
    ...def,
    responseHours: row.responseHours,
    completeHours: row.completeHours,
    escalationLadder: row.escalationLadder,
  };
}

export async function scheduleSla(
  entityId: string,
  entityType: SlaEntityType,
  stageKey: string,
  startAt: Date = new Date(),
  definition?: SlaScheduleDefinition,
): Promise<string> {
  const found =
    definition ??
    Object.values(SLA_DEFINITIONS).find(
      (d) => d.entityType === entityType && d.stageKey === stageKey,
    );
  if (!found) {
    throw new Error(`Unknown SLA definition: ${entityType}/${stageKey}`);
  }
  const def = await overlayLeadSla(found);

  const responseDueAt = addHours(startAt, def.responseHours);
  const completeDueAt =
    def.completeHours != null ? addHours(startAt, def.completeHours) : null;

  const row = await prisma.slaSchedule.upsert({
    where: {
      entityType_entityId_stageKey: { entityType, entityId, stageKey },
    },
    create: {
      entityType,
      entityId,
      stageKey,
      startedAt: startAt,
      responseWithinHours: def.responseHours,
      completeWithinHours: def.completeHours,
      responseDueAt,
      completeDueAt,
      status: SlaStatus.ACTIVE,
      escalationLadder: ladderToJson(def.escalationLadder),
    },
    update: {},
  });
  return row.id;
}

export async function markResponded(
  scheduleId: string,
  respondedAt: Date = new Date(),
): Promise<void> {
  await prisma.slaSchedule.update({
    where: { id: scheduleId },
    data: { respondedAt },
  });
}

export async function markCompleted(
  scheduleId: string,
  completedAt: Date = new Date(),
): Promise<void> {
  await prisma.slaSchedule.update({
    where: { id: scheduleId },
    data: {
      completedAt,
      status: SlaStatus.COMPLETED,
      respondedAt: completedAt,
    },
  });
}

export async function markCompletedByEntity(
  entityType: SlaEntityType,
  entityId: string,
  stageKey?: string,
): Promise<void> {
  await prisma.slaSchedule.updateMany({
    where: {
      entityType,
      entityId,
      ...(stageKey ? { stageKey } : {}),
      status: { not: SlaStatus.COMPLETED },
    },
    data: {
      completedAt: new Date(),
      status: SlaStatus.COMPLETED,
      respondedAt: new Date(),
    },
  });
}

function elapsedPct(startedAt: Date, dueAt: Date, now: Date): number {
  const total = dueAt.getTime() - startedAt.getTime();
  if (total <= 0) return 100;
  return ((now.getTime() - startedAt.getTime()) / total) * 100;
}

export async function runPendingChecks(actorUserId?: string | null): Promise<{
  checked: number;
  escalated: number;
  breached: number;
}> {
  const now = new Date();
  const active = await prisma.slaSchedule.findMany({
    where: {
      status: {
        in: [
          SlaStatus.ACTIVE,
          SlaStatus.WARNING_25PCT,
          SlaStatus.WARNING_50PCT,
          SlaStatus.BREACHED,
        ],
      },
    },
    take: 500,
  });

  let escalated = 0;
  let breached = 0;

  for (const s of active) {
    if (s.completedAt) continue;
    const pct = elapsedPct(s.startedAt, s.responseDueAt, now);
    let nextStatus = s.status;
    if (pct >= 100) nextStatus = SlaStatus.BREACHED;
    else if (pct >= 50) nextStatus = SlaStatus.WARNING_50PCT;
    else if (pct >= 25) nextStatus = SlaStatus.WARNING_25PCT;

    const ladder = (s.escalationLadder ?? []) as EscalationStep[];
    let level = s.lastEscalationLevel;
    for (let i = level; i < ladder.length; i++) {
      const step = ladder[i];
      if (pct >= step.atPct) {
        level = i + 1;
        escalated += 1;
        await prisma.eventEmission.create({
          data: {
            eventName: "sla.escalation",
            payload: {
              scheduleId: s.id,
              entityType: s.entityType,
              entityId: s.entityId,
              stageKey: s.stageKey,
              atPct: step.atPct,
              notifyRole: step.notifyRole ?? null,
              notifyUserIds: step.notifyUserIds ?? [],
            } as Prisma.InputJsonValue,
            targetSystem: "INTERNAL",
            consumerStatus: "PENDING",
          },
        });
      }
    }

    if (nextStatus !== s.status || level !== s.lastEscalationLevel) {
      await prisma.slaSchedule.update({
        where: { id: s.id },
        data: {
          status: nextStatus,
          lastEscalationLevel: level,
          lastEscalationAt: level > s.lastEscalationLevel ? now : s.lastEscalationAt,
        },
      });
      if (nextStatus === SlaStatus.BREACHED && s.status !== SlaStatus.BREACHED) {
        breached += 1;
        await audit.log({
          actorUserId: actorUserId ?? null,
          action: "sla.breached",
          entityType: "SlaSchedule",
          entityId: s.id,
          afterJson: {
            entityType: s.entityType,
            entityId: s.entityId,
            stageKey: s.stageKey,
          },
        });
      }
    }
  }

  return { checked: active.length, escalated, breached };
}
