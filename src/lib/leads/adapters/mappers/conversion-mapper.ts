import type { LeadConversion } from "../../domain/entities/LeadConversion";
import type { ConversionTarget } from "../../domain/enums";
import { jsonRecordRequired } from "./json";

export type PrismaConversionRow = {
  id: string;
  leadId: string;
  targetType: string;
  targetEntityId: string;
  decidedByUserId: string;
  eligibilitySnapshot: unknown;
  outboxEventId: string | null;
  occurredAt: Date;
  notes: string | null;
};

export function conversionToDomain(row: PrismaConversionRow): LeadConversion {
  return {
    id: row.id,
    leadId: row.leadId,
    targetType: row.targetType as ConversionTarget,
    targetEntityId: row.targetEntityId,
    decidedByUserId: row.decidedByUserId,
    eligibilitySnapshot: jsonRecordRequired(row.eligibilitySnapshot),
    outboxEventId: row.outboxEventId,
    occurredAt: row.occurredAt,
    notes: row.notes,
  };
}

export function conversionToPrisma(entity: LeadConversion): PrismaConversionRow {
  return { ...entity };
}

export const toDomain = conversionToDomain;
export const toPrisma = conversionToPrisma;
