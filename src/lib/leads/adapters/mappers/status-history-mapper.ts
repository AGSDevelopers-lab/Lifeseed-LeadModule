import type { LeadStatusHistory } from "../../domain/entities/LeadStatusHistory";
import type { LeadEvent, LeadStatus } from "../../domain/enums";

export type PrismaStatusHistoryRow = {
  id: string;
  leadId: string;
  fromStatus: string | null;
  toStatus: string;
  event: string;
  guardsPassed: unknown;
  actorUserId: string | null;
  actorRole: string | null;
  reason: string | null;
  occurredAt: Date;
  outboxEventId: string | null;
  auditRef: string | null;
};

export function statusHistoryToDomain(row: PrismaStatusHistoryRow): LeadStatusHistory {
  return {
    id: row.id,
    leadId: row.leadId,
    fromStatus: (row.fromStatus as LeadStatus | null) ?? null,
    toStatus: row.toStatus as LeadStatus,
    event: row.event as LeadEvent,
    guardsPassed: row.guardsPassed,
    actorUserId: row.actorUserId,
    actorRole: row.actorRole,
    reason: row.reason,
    occurredAt: row.occurredAt,
    outboxEventId: row.outboxEventId,
    auditRef: row.auditRef,
  };
}

export function statusHistoryToPrisma(entity: LeadStatusHistory): PrismaStatusHistoryRow {
  return { ...entity };
}

export const toDomain = statusHistoryToDomain;
export const toPrisma = statusHistoryToPrisma;
