import type { DupReviewStatus, MatchLevel } from "../enums";

export interface DuplicateCase {
  id: string;
  leftLeadId: string;
  rightLeadId: string;
  matchLevel: MatchLevel;
  matchSignals: Record<string, unknown>;
  matchScore: number;
  detectedAt: Date;
  reviewStatus: DupReviewStatus;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  mergeId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
