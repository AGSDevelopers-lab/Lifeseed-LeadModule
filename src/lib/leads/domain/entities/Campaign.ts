import type { CampaignStatus, LeadSource } from "../enums";

export interface Campaign {
  id: string;
  name: string;
  code: string;
  source: LeadSource;
  medium: string | null;
  channel: string | null;
  startAt: Date;
  endAt: Date | null;
  budgetInr: string | null;
  actualSpendInr: string | null;
  ownerUserId: string;
  creativeRefs: unknown;
  landingPageUrls: unknown;
  referralPartnerId: string | null;
  utmDefaults: Record<string, unknown> | null;
  status: CampaignStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
