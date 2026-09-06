import type { LeadDoNotCall } from "../../domain/entities/LeadDoNotCall";

/** Persistence table is still LeadDoNotCallList until B08 rename. */
export type PrismaDncRow = {
  id: string;
  phone: string;
  email: string | null;
  reason: string;
  addedByUserId: string | null;
  addedAt: Date;
  expiresAt: Date | null;
  source: string;
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
    source: row.source,
  };
}

export function dncToPrisma(entity: LeadDoNotCall): PrismaDncRow {
  return { ...entity };
}

export const toDomain = dncToDomain;
export const toPrisma = dncToPrisma;
