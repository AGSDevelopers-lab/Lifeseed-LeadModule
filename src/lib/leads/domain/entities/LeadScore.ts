import type { LeadTier, ScoreTrigger } from "../enums";

export interface LeadScore {
  id: string;
  leadId: string;
  score: number;
  tier: LeadTier;
  breakdown: Record<string, unknown>;
  configKey: string;
  configVersion: number;
  triggerReason: ScoreTrigger;
  computedByUserId: string | null;
  computedAt: Date;
  notes: string | null;
}
