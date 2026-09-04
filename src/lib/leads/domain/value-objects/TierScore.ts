import type { LeadTier } from "../enums";
import { LeadInvariantViolationError } from "../errors";

export class TierScore {
  constructor(
    readonly score: number,
    readonly tier: LeadTier,
    readonly versionRef: string,
    readonly at: Date,
  ) {
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      throw new LeadInvariantViolationError("Score must be an integer 0-100", {
        score,
      });
    }
  }
}
