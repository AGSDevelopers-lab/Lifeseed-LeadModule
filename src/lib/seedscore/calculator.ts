import {
  ChakraType,
  PackageTier,
  SeedScoreTier,
} from "@prisma/client";

import {
  CHAKRA_WEIGHTS,
  TIER_PACKAGE_ELIGIBILITY,
  TIER_THRESHOLDS,
} from "@/lib/seedscore/constants";

export type AnsweredOption = {
  chakra: ChakraType;
  scoreValue: number; // 0–10
};

/**
 * Normalize summed option scores (0–10 each) onto the chakra's fixed weight.
 * maxRaw = questionCount * 10; if questionCount is 0, returns 0.
 */
export function calculateChakraScore(
  chakra: ChakraType,
  answers: Array<{ scoreValue: number }>,
  questionCount?: number,
): number {
  const weight = CHAKRA_WEIGHTS[chakra];
  const n = questionCount ?? answers.length;
  if (n <= 0) return 0;
  const raw = answers.reduce((sum, a) => sum + Math.max(0, Math.min(10, a.scoreValue)), 0);
  const maxRaw = n * 10;
  return Math.round((raw / maxRaw) * weight);
}

export type ChakraScoreMap = Record<ChakraType, number>;

export function calculateTotalScore(chakraScores: ChakraScoreMap): number {
  return (
    chakraScores.ROOT +
    chakraScores.SACRAL +
    chakraScores.SOLAR_PLEXUS +
    chakraScores.HEART +
    chakraScores.THROAT +
    chakraScores.THIRD_EYE +
    chakraScores.CROWN
  );
}

export function deriveTier(totalScore: number): SeedScoreTier {
  if (totalScore >= TIER_THRESHOLDS.PREMIUM) return SeedScoreTier.PREMIUM;
  if (totalScore >= TIER_THRESHOLDS.STANDARD) return SeedScoreTier.STANDARD;
  if (totalScore >= TIER_THRESHOLDS.REGULAR) return SeedScoreTier.REGULAR;
  return SeedScoreTier.NOT_RECOMMENDED;
}

export function getPackageEligibility(tier: SeedScoreTier): PackageTier[] {
  return [...TIER_PACKAGE_ELIGIBILITY[tier]];
}

export function isPackageEligibleForTier(
  tier: SeedScoreTier,
  packageTier: PackageTier,
): boolean {
  return getPackageEligibility(tier).includes(packageTier);
}

/** Build full chakra score map from flat answers + per-chakra question counts. */
export function scoreFromAnswers(
  answers: AnsweredOption[],
  questionCounts: Partial<Record<ChakraType, number>>,
): { chakraScores: ChakraScoreMap; totalScore: number; tier: SeedScoreTier } {
  const byChakra = {} as Record<ChakraType, Array<{ scoreValue: number }>>;
  for (const c of Object.values(ChakraType)) {
    byChakra[c] = [];
  }
  for (const a of answers) {
    byChakra[a.chakra].push({ scoreValue: a.scoreValue });
  }

  const chakraScores = {} as ChakraScoreMap;
  for (const c of Object.values(ChakraType)) {
    chakraScores[c] = calculateChakraScore(
      c,
      byChakra[c],
      questionCounts[c] ?? byChakra[c].length,
    );
  }

  const totalScore = calculateTotalScore(chakraScores);
  return { chakraScores, totalScore, tier: deriveTier(totalScore) };
}
