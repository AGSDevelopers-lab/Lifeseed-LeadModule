import type { LeadDoNotCall } from "../../domain/entities/LeadDoNotCall";
import type { DncChannel, DncSource } from "../../domain/enums";

export type PrismaDncRow = {
  id: string;
  phone: string;
  email: string | null;
  reason: string;
  addedByUserId: string | null;
  addedAt: Date;
  expiresAt: Date | null;
  source: string;
  channel: string;
  value: string;
  normalisedValue: string;
  sourceLeadId: string | null;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  createdByUserId: string;
  removalAuthorityUserId: string | null;
  removedAt: Date | null;
  removalNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function dncToDomain(row: PrismaDncRow): LeadDoNotCall {
  return {
    id: row.id,
    phone: row.phone,
    email: row.email,
    reason: row.reason,
    addedByUserId: row.addedByUserId,
    addedAt: row.addedAt,
    expiresAt: row.expiresAt,
    source: row.source as DncSource,
    channel: row.channel as DncChannel,
    value: row.value,
    normalisedValue: row.normalisedValue,
    sourceLeadId: row.sourceLeadId,
    effectiveFrom: row.effectiveFrom,
    effectiveUntil: row.effectiveUntil,
    createdByUserId: row.createdByUserId,
    removalAuthorityUserId: row.removalAuthorityUserId,
    removedAt: row.removedAt,
    removalNote: row.removalNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function dncToPrisma(entity: LeadDoNotCall): PrismaDncRow {
  return { ...entity };
}

export function toLegacyDoNotCallListRow(entity: Pick<
  LeadDoNotCall,
  "id" | "phone" | "email" | "createdAt" | "updatedAt"
>): { id: string; phone: string; email: string | null; createdAt: Date; updatedAt: Date } {
  return {
    id: entity.id,
    phone: entity.phone,
    email: entity.email,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

export const toDomain = dncToDomain;
export const toPrisma = dncToPrisma;
