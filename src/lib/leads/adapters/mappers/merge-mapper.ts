import type { LeadMerge } from "../../domain/entities/LeadMerge";
import type { MergeCopyStrategy } from "../../domain/enums";

export type PrismaMergeRow = {
  id: string;
  duplicateCaseId: string | null;
  winnerLeadId: string;
  loserLeadId: string;
  decidedByUserId: string;
  reason: string;
  activityCopyStrategy: string;
  activitiesCopiedCount: number;
  mergedAt: Date;
  auditRef: string | null;
};

export function mergeToDomain(row: PrismaMergeRow): LeadMerge {
  return {
    id: row.id,
    duplicateCaseId: row.duplicateCaseId,
    winnerLeadId: row.winnerLeadId,
    loserLeadId: row.loserLeadId,
    decidedByUserId: row.decidedByUserId,
    reason: row.reason,
    activityCopyStrategy: row.activityCopyStrategy as MergeCopyStrategy,
    activitiesCopiedCount: row.activitiesCopiedCount,
    mergedAt: row.mergedAt,
    auditRef: row.auditRef,
  };
}

export function mergeToPrisma(entity: LeadMerge): PrismaMergeRow {
  return { ...entity };
}

export const toDomain = mergeToDomain;
export const toPrisma = mergeToPrisma;
