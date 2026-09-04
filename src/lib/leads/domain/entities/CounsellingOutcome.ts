import type { CounsellingRecommendation } from "../enums";

export interface CounsellingOutcome {
  id: string;
  sessionId: string;
  leadId: string;
  recommendation: CounsellingRecommendation;
  recommendedByUserId: string;
  rationale: string | null;
  nextActionType: string | null;
  nextActionAt: Date | null;
  createdAt: Date;
}
