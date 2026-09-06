import type { LeadScore } from "../../domain/entities/LeadScore";
import type { LeadTier, ScoreTrigger } from "../../domain/enums";
import { jsonRecordRequired } from "./json";

export type PrismaScoreRow = {
  id: string;
  leadId: string;
  score: number;
  tier: string;
  breakdown: unknown;
  configKey: string;
  configVersion: number;
  triggerReason: string;
  computedByUserId: string | null;
  computedAt: Date;
  notes: string | null;
};

export function scoreToDomain(row: PrismaScoreRow): LeadScore {
  return {
    id: row.id,
    leadId: row.leadId,
    score: row.score,
    tier: row.tier as LeadTier,
    breakdown: jsonRecordRequired(row.breakdown),
    configKey: row.configKey,
    configVersion: row.configVersion,
    triggerReason: row.triggerReason as ScoreTrigger,
    computedByUserId: row.computedByUserId,
    computedAt: row.computedAt,
    notes: row.notes,
  };
}

export function scoreToPrisma(entity: LeadScore): PrismaScoreRow {
  return { ...entity };
}

export const toDomain = scoreToDomain;
export const toPrisma = scoreToPrisma;
