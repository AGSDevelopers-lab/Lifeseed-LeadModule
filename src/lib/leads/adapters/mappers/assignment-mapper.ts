import type { LeadAssignment } from "../../domain/entities/LeadAssignment";
import type { AssignmentType } from "../../domain/enums";
import { jsonRecord } from "./json";

export type PrismaAssignmentRow = {
  id: string;
  leadId: string;
  assigneeUserId: string;
  assignedByUserId: string | null;
  assignmentType: string;
  reason: string | null;
  startedAt: Date;
  endedAt: Date | null;
  endReason: string | null;
  siteId: string;
  metadata: unknown;
};

export function assignmentToDomain(row: PrismaAssignmentRow): LeadAssignment {
  return {
    id: row.id,
    leadId: row.leadId,
    assigneeUserId: row.assigneeUserId,
    assignedByUserId: row.assignedByUserId,
    assignmentType: row.assignmentType as AssignmentType,
    reason: row.reason,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    endReason: row.endReason,
    siteId: row.siteId,
    metadata: jsonRecord(row.metadata),
  };
}

export function assignmentToPrisma(entity: LeadAssignment): PrismaAssignmentRow {
  return { ...entity };
}

export const toDomain = assignmentToDomain;
export const toPrisma = assignmentToPrisma;
