import type { FollowUpPriority, FollowUpStatus, FollowUpType } from "../enums";

export interface LeadFollowUp {
  id: string;
  leadId: string;
  ownerUserId: string;
  type: FollowUpType;
  priority: FollowUpPriority;
  reason: string | null;
  dueAt: Date;
  status: FollowUpStatus;
  completedAt: Date | null;
  completedByUserId: string | null;
  outcome: string | null;
  nextFollowUpId: string | null;
  rescheduledFromId: string | null;
  cancelReason: string | null;
  slaScheduleId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
