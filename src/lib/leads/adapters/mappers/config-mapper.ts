import type { LeadConfig } from "../../domain/entities/LeadConfig";
import { jsonRecordRequired } from "./json";

export type PrismaConfigRow = {
  id: string;
  key: string;
  version: number;
  payload: unknown;
  payloadSchemaRef: string;
  ownerRole: string;
  createdByUserId: string;
  createdAt: Date;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  isActive: boolean;
  notes: string | null;
};

export function configToDomain(row: PrismaConfigRow): LeadConfig {
  return {
    id: row.id,
    key: row.key,
    version: row.version,
    payload: jsonRecordRequired(row.payload),
    payloadSchemaRef: row.payloadSchemaRef,
    ownerRole: row.ownerRole,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    approvedByUserId: row.approvedByUserId,
    approvedAt: row.approvedAt,
    effectiveFrom: row.effectiveFrom,
    effectiveUntil: row.effectiveUntil,
    isActive: row.isActive,
    notes: row.notes,
  };
}

export function configToPrisma(entity: LeadConfig): PrismaConfigRow {
  return { ...entity };
}

export const toDomain = configToDomain;
export const toPrisma = configToPrisma;
