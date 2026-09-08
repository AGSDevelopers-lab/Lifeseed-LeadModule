import {
  LeadActivityType,
  LeadChannel,
} from "../domain/enums";
import type { LeadActivityType as LeadActivityTypeT } from "../domain/enums";
import { LeadGuardFailedError, LeadInvariantViolationError } from "../domain/errors";
import type { ActorContext } from "../domain/ports/shared";

const ACTIVITY_TYPES = Object.values(LeadActivityType) as LeadActivityTypeT[];

export function permissionForActivityType(activityType: LeadActivityTypeT): string {
  if (activityType === LeadActivityType.CALL) return "lead.disposition";
  if (activityType === LeadActivityType.NOTE) return "lead.note.add";
  if (activityType === LeadActivityType.FOLLOW_UP) return "follow_up.create";
  return "lead.note.add";
}

export type RecordActivityInput = {
  leadId: string;
  actor: ActorContext;
  activityType: string;
  summary?: string | null;
  outcome?: string | null;
  nextAction?: string | null;
  nextActionDueAt?: Date | null;
  channel?: string | null;
  metadata?: Record<string, unknown> | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
};

export function parseActivityType(raw: string): LeadActivityTypeT {
  if ((ACTIVITY_TYPES as string[]).includes(raw)) {
    return raw as LeadActivityTypeT;
  }
  throw new LeadInvariantViolationError("Unknown LeadActivityType", { activityType: raw });
}

export async function recordLeadActivity(input: RecordActivityInput): Promise<{ id: string }> {
  const activityType = parseActivityType(input.activityType);
  const { prisma } = await import("@/lib/db");
  const now = new Date();
  const row = await prisma.leadActivity.create({
    data: {
      leadId: input.leadId,
      activityType: activityType as never,
      channel: (input.channel as never) ?? "OUTBOUND",
      actorUserId: input.actor.userId,
      actorRole: input.actor.roles[0] ?? null,
      occurredAt: now,
      summary: input.summary ?? null,
      outcome: input.outcome ?? null,
      nextAction: input.nextAction ?? null,
      nextActionDueAt: input.nextActionDueAt ?? null,
      metadata: input.metadata ?? undefined,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
    },
  });
  return { id: row.id };
}

export function assertActivityTypeKnown(raw: string): LeadActivityTypeT {
  try {
    return parseActivityType(raw);
  } catch {
    throw new LeadGuardFailedError("Invalid activity type", { activityType: raw });
  }
}

export { LeadChannel };
