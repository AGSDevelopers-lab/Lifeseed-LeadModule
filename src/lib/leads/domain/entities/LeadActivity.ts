import type { LeadActivityType, LeadChannel } from "../enums";

export interface LeadActivity {
  id: string;
  leadId: string;
  activityType: LeadActivityType;
  channel: LeadChannel | null;
  actorUserId: string | null;
  actorRole: string | null;
  occurredAt: Date;
  summary: string | null;
  outcome: string | null;
  nextAction: string | null;
  nextActionDueAt: Date | null;
  metadata: Record<string, unknown> | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  auditRef: string | null;
  createdAt: Date;
}
