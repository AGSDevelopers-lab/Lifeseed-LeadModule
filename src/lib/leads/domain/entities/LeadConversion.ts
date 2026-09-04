import type { ConversionTarget } from "../enums";

export interface LeadConversion {
  id: string;
  leadId: string;
  targetType: ConversionTarget;
  targetEntityId: string;
  decidedByUserId: string;
  eligibilitySnapshot: Record<string, unknown>;
  outboxEventId: string | null;
  occurredAt: Date;
  notes: string | null;
}
