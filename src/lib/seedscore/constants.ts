import {
  ChakraType,
  PackageTier,
  SeedScoreTier,
} from "@prisma/client";

/** Fixed LifeSeed 7-Chakra weights (sum = 100). */
export const CHAKRA_WEIGHTS: Record<ChakraType, number> = {
  ROOT: 14,
  SACRAL: 14,
  SOLAR_PLEXUS: 14,
  HEART: 14,
  THROAT: 14,
  THIRD_EYE: 16,
  CROWN: 14,
};

export const CHAKRA_ORDER: ChakraType[] = [
  ChakraType.ROOT,
  ChakraType.SACRAL,
  ChakraType.SOLAR_PLEXUS,
  ChakraType.HEART,
  ChakraType.THROAT,
  ChakraType.THIRD_EYE,
  ChakraType.CROWN,
];

export const CHAKRA_LABEL: Record<ChakraType, string> = {
  ROOT: "Root",
  SACRAL: "Sacral",
  SOLAR_PLEXUS: "Solar Plexus",
  HEART: "Heart",
  THROAT: "Throat",
  THIRD_EYE: "Third Eye",
  CROWN: "Crown",
};

/** Inclusive lower bounds for tier derivation. */
export const TIER_THRESHOLDS = {
  PREMIUM: 85,
  STANDARD: 70,
  REGULAR: 55,
} as const;

/**
 * Which package tiers a donor's material may typically be sold in.
 * NOT_RECOMMENDED → empty (flag for BRM).
 */
export const TIER_PACKAGE_ELIGIBILITY: Record<SeedScoreTier, PackageTier[]> = {
  NOT_RECOMMENDED: [],
  REGULAR: [PackageTier.BASIC],
  STANDARD: [PackageTier.STANDARD, PackageTier.PREMIUM],
  PREMIUM: [PackageTier.PREMIUM],
  UNSCORED: [PackageTier.BASIC, PackageTier.STANDARD, PackageTier.PREMIUM],
};

export const SUB_DIMENSIONS_PER_CHAKRA: Partial<
  Record<ChakraType, string[]>
> = {
  HEART: ["emotional", "cardiovascular", "psychological"],
  THROAT: ["lifestyle", "respiratory", "genetic_family"],
  THIRD_EYE: ["mental_clarity", "art_awareness", "medico_legal"],
};

export const TIER_LABEL: Record<SeedScoreTier, string> = {
  PREMIUM: "Premium",
  STANDARD: "Standard",
  REGULAR: "Regular",
  NOT_RECOMMENDED: "Not Recommended",
  UNSCORED: "Unscored",
};

export function isSeedScoreGateEnabled(): boolean {
  return process.env.SEEDSCORE_GATE_ENABLED === "true";
}

export function isSeedScoreVisibleToDonor(): boolean {
  return process.env.SEEDSCORE_VISIBLE_TO_DONOR === "true";
}

export function isSeedScoreVisibleToRecipient(): boolean {
  return process.env.SEEDSCORE_VISIBLE_TO_RECIPIENT === "true";
}

export function isSeedScoreRecalcOnSchedule(): boolean {
  return process.env.SEEDSCORE_RECALC_ON_SCHEDULE === "true";
}
