import {
  LeadDonorSubType,
  LeadPersonType,
  LeadSource,
  LeadTier,
} from "@prisma/client";

import { DEFAULT_SCORE_WEIGHTS } from "@/lib/leads/config/defaults";
import { CONFIG_KEYS } from "@/lib/leads/config/keys";
import type { ScoreWeights } from "@/lib/leads/config/schemas";

export type LeadScoreInput = {
  personType: LeadPersonType;
  donorSubType?: LeadDonorSubType | null;
  source: LeadSource;
  ageGroup?: string | null;
  city?: string | null;
  state?: string | null;
  preferredLanguage?: string | null;
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  pincode?: string | null;
  /** Hours from capture to first response; null if not yet responded */
  responseHours?: number | null;
};

export type LeadScoreResult = {
  score: number;
  breakdown: Record<string, number>;
  tier: LeadTier;
};

function ageContribution(
  personType: LeadPersonType,
  donorSubType: LeadDonorSubType | null | undefined,
  ageGroup: string | null | undefined,
  w: ScoreWeights,
): number {
  if (personType === LeadPersonType.RECIPIENT) return w.recipientAgePoints;
  if (!ageGroup) return w.ageUnknown;
  const m = ageGroup.match(/(\d+)\s*[-–]\s*(\d+)/);
  const mid = m ? (Number(m[1]) + Number(m[2])) / 2 : Number(ageGroup);
  if (!Number.isFinite(mid)) return w.ageUnknown;

  const band = donorSubType === LeadDonorSubType.OOCYTE ? w.oocyte : w.semen;
  if (mid >= band.coreMin && mid <= band.coreMax) return band.corePoints;
  if (mid >= band.extendedMin && mid <= band.extendedMax) return band.extendedPoints;
  return band.elsePoints;
}

function responseContribution(hours: number | null | undefined, w: ScoreWeights): number {
  if (hours == null) return 0;
  if (hours <= 1) return w.response.le1h;
  if (hours <= 6) return w.response.le6h;
  if (hours <= 24) return w.response.le24h;
  return w.response.elsePoints;
}

function completenessContribution(input: LeadScoreInput, w: ScoreWeights): number {
  const fields = [
    input.fullName,
    input.phone,
    input.email,
    input.city,
    input.state,
    input.pincode,
    input.ageGroup,
    input.preferredLanguage,
  ];
  const filled = fields.filter((f) => f != null && String(f).trim() !== "").length;
  return Math.round((filled / fields.length) * w.completenessMax);
}

function locationContribution(
  city: string | null | undefined,
  state: string | null | undefined,
  w: ScoreWeights,
): number {
  const areas = new Set(w.serviceAreas);
  const keys = [city, state]
    .filter(Boolean)
    .map((s) => s!.trim().toLowerCase().replace(/\s+/g, ""));
  if (keys.some((k) => areas.has(k))) return w.locationInServiceArea;
  return keys.length ? w.locationOutOfArea : 0;
}

function languageContribution(lang: string | null | undefined, w: ScoreWeights): number {
  if (!lang) return 0;
  return new Set(w.supportedLanguages).has(lang.trim().toLowerCase()) ? w.languageSupported : 0;
}

export function deriveLeadTier(score: number, w: ScoreWeights = DEFAULT_SCORE_WEIGHTS): LeadTier {
  if (score >= w.tiers.hot) return LeadTier.HOT;
  if (score >= w.tiers.warm) return LeadTier.WARM;
  if (score >= w.tiers.cold) return LeadTier.COLD;
  return LeadTier.ARCHIVED;
}

export function scoreLead(
  input: LeadScoreInput,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
): LeadScoreResult {
  const breakdown: Record<string, number> = {
    age: ageContribution(input.personType, input.donorSubType, input.ageGroup, weights),
    source: weights.sourcePoints[input.source] ?? 2,
    responseSpeed: responseContribution(input.responseHours, weights),
    completeness: completenessContribution(input, weights),
    location: locationContribution(input.city, input.state, weights),
    language: languageContribution(input.preferredLanguage, weights),
  };
  const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const score = Math.max(0, Math.min(100, raw));
  return { score, breakdown, tier: deriveLeadTier(score, weights) };
}

export async function resolveScoreWeights(at?: Date): Promise<{
  weights: ScoreWeights;
  configVersion: number | null;
}> {
  const { prisma } = await import("@/lib/db");
  const { getConfigStoreAdapter } = await import("@/lib/leads/adapters/config-store-adapter");
  const { resolveConfigPayload } = await import("@/lib/leads/application/config-store");
  const adapter = getConfigStoreAdapter(prisma);
  const weights = await resolveConfigPayload(
    adapter,
    CONFIG_KEYS.SCORE_WEIGHTS_V1,
    DEFAULT_SCORE_WEIGHTS,
    at ? { at } : undefined,
  );
  const configVersion = await adapter.currentVersion(CONFIG_KEYS.SCORE_WEIGHTS_V1);
  return { weights, configVersion };
}

export async function scoreLeadWithConfig(input: LeadScoreInput): Promise<
  LeadScoreResult & { configKey: string; configVersion: number }
> {
  const { weights, configVersion } = await resolveScoreWeights();
  return {
    ...scoreLead(input, weights),
    configKey: CONFIG_KEYS.SCORE_WEIGHTS_V1,
    configVersion: configVersion ?? 1,
  };
}
