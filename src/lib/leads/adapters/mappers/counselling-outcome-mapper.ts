import type { CounsellingOutcome } from "../../domain/entities/CounsellingOutcome";
import type { CounsellingRecommendation } from "../../domain/enums";

export type PrismaCounsellingOutcomeRow = {
  id: string;
  sessionId: string;
  leadId: string;
  recommendation: string;
  recommendedByUserId: string;
  rationale: string | null;
  nextActionType: string | null;
  nextActionAt: Date | null;
  createdAt: Date;
};

export function counsellingOutcomeToDomain(
  row: PrismaCounsellingOutcomeRow,
): CounsellingOutcome {
  return {
    id: row.id,
    sessionId: row.sessionId,
    leadId: row.leadId,
    recommendation: row.recommendation as CounsellingRecommendation,
    recommendedByUserId: row.recommendedByUserId,
    rationale: row.rationale,
    nextActionType: row.nextActionType,
    nextActionAt: row.nextActionAt,
    createdAt: row.createdAt,
  };
}

export function counsellingOutcomeToPrisma(
  entity: CounsellingOutcome,
): PrismaCounsellingOutcomeRow {
  return { ...entity };
}

export const toDomain = counsellingOutcomeToDomain;
export const toPrisma = counsellingOutcomeToPrisma;
