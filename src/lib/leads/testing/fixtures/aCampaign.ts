import { CampaignStatus, LeadSource } from "../../domain/enums";
import type { Campaign } from "../../domain/entities/Campaign";

export function aCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: "camp_1",
    name: "WB Oct test",
    code: "WB_OCT26_TEST",
    source: LeadSource.CAMPAIGN,
    medium: "instagram_paid",
    channel: "paid_social",
    startAt: new Date("2026-09-01T00:00:00.000Z"),
    endAt: null,
    budgetInr: "100000.00",
    actualSpendInr: null,
    ownerUserId: "user_mkt",
    creativeRefs: [],
    landingPageUrls: [],
    referralPartnerId: null,
    utmDefaults: { utm_campaign: "WB_OCT26_TEST" },
    status: CampaignStatus.ACTIVE,
    notes: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  };
}
