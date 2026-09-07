import type { DncChannel, DncSource } from "../enums";

export interface LeadDoNotCall {
  id: string;
  channel: DncChannel;
  value: string;
  normalisedValue: string;
  phone: string;
  email: string | null;
  reason: string;
  addedByUserId: string | null;
  addedAt: Date;
  expiresAt: Date | null;
  source: DncSource | string;
  sourceLeadId: string | null;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  createdByUserId: string;
  removalAuthorityUserId: string | null;
  removedAt: Date | null;
  removalNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}
