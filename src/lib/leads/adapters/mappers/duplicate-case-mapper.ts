import type { DuplicateCase } from "../../domain/entities/DuplicateCase";
import type { DupReviewStatus, MatchLevel } from "../../domain/enums";
import { jsonRecordRequired } from "./json";

export type PrismaDuplicateCaseRow = {
  id: string;
  leftLeadId: string;
  rightLeadId: string;
  matchLevel: string;
  matchSignals: unknown;
  matchScore: number;
  detectedAt: Date;
  reviewStatus: string;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  mergeId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function duplicateCaseToDomain(row: PrismaDuplicateCaseRow): DuplicateCase {
  return {
    id: row.id,
    leftLeadId: row.leftLeadId,
    rightLeadId: row.rightLeadId,
    matchLevel: row.matchLevel as MatchLevel,
    matchSignals: jsonRecordRequired(row.matchSignals),
    matchScore: row.matchScore,
    detectedAt: row.detectedAt,
    reviewStatus: row.reviewStatus as DupReviewStatus,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt,
    reviewNotes: row.reviewNotes,
    mergeId: row.mergeId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function duplicateCaseToPrisma(entity: DuplicateCase): PrismaDuplicateCaseRow {
  return { ...entity };
}

export const toDomain = duplicateCaseToDomain;
export const toPrisma = duplicateCaseToPrisma;
