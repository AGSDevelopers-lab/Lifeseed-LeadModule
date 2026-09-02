/**
 * Smoke checks for SeedScore calculator + visibility (run with: npx tsx src/lib/seedscore/smoke.ts)
 */
import assert from "node:assert/strict";
import { ChakraType, PackageTier, SeedScoreTier, UserRole } from "@prisma/client";

import {
  calculateChakraScore,
  calculateTotalScore,
  deriveTier,
  getPackageEligibility,
  scoreFromAnswers,
} from "@/lib/seedscore/calculator";
import { CHAKRA_WEIGHTS } from "@/lib/seedscore/constants";
import { getSeedScoreVisibility } from "@/lib/seedscore/visibility";

const weightSum = Object.values(CHAKRA_WEIGHTS).reduce((a, b) => a + b, 0);
assert.equal(weightSum, 100, "chakra weights must sum to 100");

assert.equal(deriveTier(90), SeedScoreTier.PREMIUM);
assert.equal(deriveTier(85), SeedScoreTier.PREMIUM);
assert.equal(deriveTier(70), SeedScoreTier.STANDARD);
assert.equal(deriveTier(55), SeedScoreTier.REGULAR);
assert.equal(deriveTier(54), SeedScoreTier.NOT_RECOMMENDED);

assert.deepEqual(getPackageEligibility(SeedScoreTier.REGULAR), [
  PackageTier.BASIC,
]);
assert.deepEqual(getPackageEligibility(SeedScoreTier.PREMIUM), [
  PackageTier.PREMIUM,
]);

const root = calculateChakraScore(ChakraType.ROOT, [
  { scoreValue: 10 },
  { scoreValue: 10 },
]);
assert.equal(root, 14);

const scored = scoreFromAnswers(
  Object.values(ChakraType).flatMap((c) => [
    { chakra: c, scoreValue: 10 },
  ]),
  Object.fromEntries(Object.values(ChakraType).map((c) => [c, 1])),
);
assert.equal(scored.totalScore, 100);
assert.equal(scored.tier, SeedScoreTier.PREMIUM);
assert.equal(calculateTotalScore(scored.chakraScores), 100);

const bank = getSeedScoreVisibility([UserRole.BANK_BRM], {});
assert.equal(bank.showBreakdown, true);

const recipientOff = getSeedScoreVisibility([UserRole.RECIPIENT], {});
assert.equal(recipientOff.showNumeric, false);

console.log("seedscore smoke: ok");
