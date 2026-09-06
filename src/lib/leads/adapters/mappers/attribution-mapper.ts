import type { LeadAttribution } from "../../domain/entities/LeadAttribution";
import type { LeadSource } from "../../domain/enums";
import { AttributionTouch } from "../../domain/value-objects/AttributionTouch";
import { jsonRecord } from "./json";

export type PrismaAttributionRow = {
  id: string;
  leadId: string;
  firstTouchAt: Date;
  firstTouchSource: string;
  firstTouchCampaignId: string | null;
  firstTouchMedium: string | null;
  firstTouchChannel: string | null;
  firstTouchCreativeRef: string | null;
  firstTouchLandingUrl: string | null;
  firstTouchReferralPartnerId: string | null;
  firstTouchUtm: unknown;
  lastTouchAt: Date;
  lastTouchSource: string;
  lastTouchCampaignId: string | null;
  lastTouchMedium: string | null;
  lastTouchChannel: string | null;
  lastTouchCreativeRef: string | null;
  lastTouchLandingUrl: string | null;
  lastTouchReferralPartnerId: string | null;
  lastTouchUtm: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function touchFrom(
  at: Date,
  source: string,
  campaignId: string | null,
  medium: string | null,
  channel: string | null,
  creativeRef: string | null,
  landingUrl: string | null,
  referralPartnerId: string | null,
  utm: unknown,
): AttributionTouch {
  return new AttributionTouch(
    at,
    source as LeadSource,
    campaignId,
    medium,
    channel,
    creativeRef,
    landingUrl,
    referralPartnerId,
    jsonRecord(utm),
  );
}

export function attributionToDomain(row: PrismaAttributionRow): LeadAttribution {
  return {
    id: row.id,
    leadId: row.leadId,
    firstTouch: touchFrom(
      row.firstTouchAt,
      row.firstTouchSource,
      row.firstTouchCampaignId,
      row.firstTouchMedium,
      row.firstTouchChannel,
      row.firstTouchCreativeRef,
      row.firstTouchLandingUrl,
      row.firstTouchReferralPartnerId,
      row.firstTouchUtm,
    ),
    lastTouch: touchFrom(
      row.lastTouchAt,
      row.lastTouchSource,
      row.lastTouchCampaignId,
      row.lastTouchMedium,
      row.lastTouchChannel,
      row.lastTouchCreativeRef,
      row.lastTouchLandingUrl,
      row.lastTouchReferralPartnerId,
      row.lastTouchUtm,
    ),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function attributionToPrisma(entity: LeadAttribution): PrismaAttributionRow {
  const f = entity.firstTouch;
  const l = entity.lastTouch;
  return {
    id: entity.id,
    leadId: entity.leadId,
    firstTouchAt: f.at,
    firstTouchSource: f.source,
    firstTouchCampaignId: f.campaignId,
    firstTouchMedium: f.medium,
    firstTouchChannel: f.channel,
    firstTouchCreativeRef: f.creativeRef,
    firstTouchLandingUrl: f.landingUrl,
    firstTouchReferralPartnerId: f.referralPartnerId,
    firstTouchUtm: f.utm,
    lastTouchAt: l.at,
    lastTouchSource: l.source,
    lastTouchCampaignId: l.campaignId,
    lastTouchMedium: l.medium,
    lastTouchChannel: l.channel,
    lastTouchCreativeRef: l.creativeRef,
    lastTouchLandingUrl: l.landingUrl,
    lastTouchReferralPartnerId: l.referralPartnerId,
    lastTouchUtm: l.utm,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

export const toDomain = attributionToDomain;
export const toPrisma = attributionToPrisma;
