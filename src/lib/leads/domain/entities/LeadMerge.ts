import type { MergeCopyStrategy } from "../enums";

export interface LeadMerge {
  id: string;
  duplicateCaseId: string | null;
  winnerLeadId: string;
  loserLeadId: string;
  decidedByUserId: string;
  reason: string;
  activityCopyStrategy: MergeCopyStrategy;
  activitiesCopiedCount: number;
  mergedAt: Date;
  auditRef: string | null;
}
