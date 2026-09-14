export const TOUCH_RECORD_SCHEMA_MAPPING = {
  source: "LeadAttribution.firstTouchSource | lastTouchSource",
  medium: "LeadAttribution.firstTouchMedium | lastTouchMedium",
  campaignCode: "Campaign.code via firstTouchCampaignId | lastTouchCampaignId",
  term: "LeadAttribution.firstTouchUtm.term | utm_term",
  content: "LeadAttribution.firstTouchUtm.content | utm_content",
  landingPage: "LeadAttribution.firstTouchLandingUrl | lastTouchLandingUrl",
  creative: "LeadAttribution.firstTouchCreativeRef | lastTouchCreativeRef",
  referralPartner:
    "LeadAttribution.firstTouchReferralPartnerId | lastTouchReferralPartnerId",
  capturedAt: "LeadAttribution.firstTouchAt | lastTouchAt",
} as const;
