import type { AssignmentType } from "../enums";

export interface LeadAssignment {
  id: string;
  leadId: string;
  assigneeUserId: string;
  assignedByUserId: string | null;
  assignmentType: AssignmentType;
  reason: string | null;
  startedAt: Date;
  endedAt: Date | null;
  endReason: string | null;
  siteId: string;
  metadata: Record<string, unknown> | null;
}
