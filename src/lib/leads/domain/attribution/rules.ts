import { CampaignStatus, LeadSource, TouchType } from "../enums";
import type { CampaignStatus as CampaignStatusT, LeadSource as LeadSourceT, TouchType as TouchTypeT } from "../enums";

export type UtmBlob = {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  [key: string]: unknown;
};

export type CaptureTouchFields = {
  source: LeadSourceT;
  campaignId: string | null;
  medium: string | null;
  channel: string | null;
  creativeRef: string | null;
  landingUrl: string | null;
  referralPartnerId: string | null;
  utm: UtmBlob;
};

const LEAD_SOURCES = new Set<string>(Object.values(LeadSource));

/** Map a raw UTM source string to LeadSource when it matches exactly; otherwise leave typed source unchanged. */
export function canonicalSource(typed: LeadSourceT, rawUtmSource?: string | null): LeadSourceT {
  if (rawUtmSource && LEAD_SOURCES.has(rawUtmSource)) {
    return rawUtmSource as LeadSourceT;
  }
  return typed;
}

/** Preserve raw UTM keys verbatim; never drop campaign even when resolution fails. */
export function preserveUtm(raw: Record<string, unknown> | null | undefined, extras?: Partial<UtmBlob>): UtmBlob {
  const blob: UtmBlob = { ...(raw ?? {}) };
  if (extras) {
    for (const [k, v] of Object.entries(extras)) {
      if (v !== undefined) blob[k] = v;
    }
  }
  return blob;
}

export function historyTouchType(isFirstRow: boolean): TouchTypeT {
  return isFirstRow ? TouchType.FIRST : TouchType.SUBSEQUENT;
}

export type CampaignLifecycleAction = "activate" | "end" | "patch-status";

const LEGAL: Record<CampaignLifecycleAction, Partial<Record<CampaignStatusT, CampaignStatusT>>> = {
  activate: {
    [CampaignStatus.DRAFT]: CampaignStatus.ACTIVE,
    [CampaignStatus.PAUSED]: CampaignStatus.ACTIVE,
  },
  end: {
    [CampaignStatus.ACTIVE]: CampaignStatus.ENDED,
  },
  "patch-status": {
    [CampaignStatus.ACTIVE]: CampaignStatus.PAUSED,
  },
};

export function isLegalCampaignTransition(
  action: CampaignLifecycleAction,
  from: CampaignStatusT,
  to?: CampaignStatusT,
): boolean {
  const next = LEGAL[action][from];
  if (!next) return false;
  if (to && to !== next) return false;
  return true;
}

export function requiredNextStatus(action: CampaignLifecycleAction, from: CampaignStatusT): CampaignStatusT | null {
  return LEGAL[action][from] ?? null;
}

/** PATCH may only set status to PAUSED, and only from ACTIVE. */
export function isLegalPatchStatus(from: CampaignStatusT, requested: CampaignStatusT): boolean {
  return requested === CampaignStatus.PAUSED && isLegalCampaignTransition("patch-status", from, requested);
}

export function resolveCampaignIdRule(input: {
  campaignId?: string | null;
  utmCampaign?: string | null;
  matchedCodeId?: string | null;
}): string | null {
  if (input.campaignId) return input.matchedCodeId ?? null;
  if (input.utmCampaign) return input.matchedCodeId ?? null;
  return null;
}
