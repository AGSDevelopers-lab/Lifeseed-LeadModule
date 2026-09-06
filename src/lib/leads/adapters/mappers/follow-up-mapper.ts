import type { LeadFollowUp } from "../../domain/entities/LeadFollowUp";
import type { FollowUpPriority, FollowUpStatus, FollowUpType } from "../../domain/enums";

export type PrismaFollowUpRow = {
  id: string;
  leadId: string;
  ownerUserId: string;
  type: string;
  priority: string;
  reason: string | null;
  dueAt: Date;
  status: string;
  completedAt: Date | null;
  completedByUserId: string | null;
  outcome: string | null;
  nextFollowUpId: string | null;
  rescheduledFromId: string | null;
  cancelReason: string | null;
  slaScheduleId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function followUpToDomain(row: PrismaFollowUpRow): LeadFollowUp {
  return {
    id: row.id,
    leadId: row.leadId,
    ownerUserId: row.ownerUserId,
    type: row.type as FollowUpType,
    priority: row.priority as FollowUpPriority,
    reason: row.reason,
    dueAt: row.dueAt,
    status: row.status as FollowUpStatus,
    completedAt: row.completedAt,
    completedByUserId: row.completedByUserId,
    outcome: row.outcome,
    nextFollowUpId: row.nextFollowUpId,
    rescheduledFromId: row.rescheduledFromId,
    cancelReason: row.cancelReason,
    slaScheduleId: row.slaScheduleId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function followUpToPrisma(entity: LeadFollowUp): PrismaFollowUpRow {
  return { ...entity };
}

export const toDomain = followUpToDomain;
export const toPrisma = followUpToPrisma;
