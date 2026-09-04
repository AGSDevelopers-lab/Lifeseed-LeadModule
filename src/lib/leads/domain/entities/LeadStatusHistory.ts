import type { LeadEvent, LeadStatus } from "../enums";

export interface LeadStatusHistory {
  id: string;
  leadId: string;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus;
  event: LeadEvent;
  guardsPassed: unknown;
  actorUserId: string | null;
  actorRole: string | null;
  reason: string | null;
  occurredAt: Date;
  outboxEventId: string | null;
  auditRef: string | null;
}
