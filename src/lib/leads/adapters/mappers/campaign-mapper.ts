import type { Campaign } from "../../domain/entities/Campaign";
import type { CampaignStatus, LeadSource } from "../../domain/enums";
import { jsonRecord, moneyToString } from "./json";

export type PrismaCampaignRow = {
  id: string;
  name: string;
  code: string;
  source: string;
  medium: string | null;
  channel: string | null;
  startAt: Date;
  endAt: Date | null;
  budgetInr: unknown;
  actualSpendInr: unknown;
  ownerUserId: string;
  creativeRefs: unknown;
  landingPageUrls: unknown;
  referralPartnerId: string | null;
  utmDefaults: unknown;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function campaignToDomain(row: PrismaCampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    source: row.source as LeadSource,
    medium: row.medium,
    channel: row.channel,
    startAt: row.startAt,
    endAt: row.endAt,
    budgetInr: moneyToString(row.budgetInr),
    actualSpendInr: moneyToString(row.actualSpendInr),
    ownerUserId: row.ownerUserId,
    creativeRefs: row.creativeRefs,
    landingPageUrls: row.landingPageUrls,
    referralPartnerId: row.referralPartnerId,
    utmDefaults: jsonRecord(row.utmDefaults),
    status: row.status as CampaignStatus,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function campaignToPrisma(entity: Campaign): PrismaCampaignRow {
  return { ...entity };
}

export const toDomain = campaignToDomain;
export const toPrisma = campaignToPrisma;
