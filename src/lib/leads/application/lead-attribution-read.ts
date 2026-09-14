import { prisma } from "@/lib/db";
import { attributionToDomain } from "../adapters/mappers/attribution-mapper";
import { TOUCH_RECORD_SCHEMA_MAPPING } from "./lead-attribution-mapping";

export { TOUCH_RECORD_SCHEMA_MAPPING };

/**
 * Locked TouchRecord contract mapped from live `LeadAttribution` + `Campaign`.
 * Field-by-field mapping: see `TOUCH_RECORD_SCHEMA_MAPPING`.
 */

export type TouchRecord = {
  source: string;
  medium: string | null;
  campaignCode: string | null;
  term: string | null;
  content: string | null;
  landingPage: string | null;
  creative: string | null;
  referralPartner: string | null;
  capturedAt: string;
};

export type LeadAttributionResponse = {
  firstTouch: TouchRecord | null;
  lastTouch: TouchRecord | null;
};

function utmString(utm: Record<string, unknown> | null, keys: string[]): string | null {
  if (!utm) return null;
  for (const k of keys) {
    const v = utm[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function toTouch(
  touch: {
    at: Date;
    source: string;
    campaignId: string | null;
    medium: string | null;
    creativeRef: string | null;
    landingUrl: string | null;
    referralPartnerId: string | null;
    utm: Record<string, unknown> | null;
  },
  campaignCode: string | null,
): TouchRecord {
  return {
    source: touch.source,
    medium: touch.medium,
    campaignCode,
    term: utmString(touch.utm, ["term", "utm_term"]),
    content: utmString(touch.utm, ["content", "utm_content"]),
    landingPage: touch.landingUrl,
    creative: touch.creativeRef,
    referralPartner: touch.referralPartnerId,
    capturedAt: touch.at.toISOString(),
  };
}

export async function getLeadAttribution(leadId: string): Promise<LeadAttributionResponse> {
  const row = await prisma.leadAttribution.findUnique({
    where: { leadId },
    include: {
      firstTouchCampaign: { select: { code: true } },
      lastTouchCampaign: { select: { code: true } },
    },
  });
  if (!row) return { firstTouch: null, lastTouch: null };
  const domain = attributionToDomain(row);
  return {
    firstTouch: toTouch(domain.firstTouch, row.firstTouchCampaign?.code ?? null),
    lastTouch: toTouch(domain.lastTouch, row.lastTouchCampaign?.code ?? null),
  };
}
