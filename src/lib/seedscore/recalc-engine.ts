import {
  ChakraType,
  RecalcTrigger,
  SeedScoreTier,
  type Donor,
  type Prisma,
} from "@prisma/client";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { scoreFromAnswers } from "@/lib/seedscore/calculator";
import { CHAKRA_ORDER } from "@/lib/seedscore/constants";

export type AnswerInput = {
  questionId: string;
  selectedOptionId: string;
  notes?: string | null;
};

export function shouldRecalculate(
  donor: Pick<Donor, "scoreRecalcRequired" | "lastScoredAt" | "status">,
  trigger: RecalcTrigger,
): boolean {
  if (trigger === RecalcTrigger.MANUAL_BRM) return true;
  if (trigger === RecalcTrigger.RUBRIC_UPDATE) return true;
  if (trigger === RecalcTrigger.DONOR_SELF_UPDATE) return true;
  if (trigger === RecalcTrigger.INTAKE_COMPLETION) return true;
  if (trigger === RecalcTrigger.LAB_RESULTS) return true;
  if (trigger === RecalcTrigger.POST_DONATION) return true;
  if (trigger === RecalcTrigger.SCHEDULED_6M) {
    return donor.scoreRecalcRequired === true;
  }
  return false;
}

/**
 * Marks donor for async BRM recalculation (does not compute immediately).
 */
export async function triggerRecalc(
  donorId: string,
  trigger: RecalcTrigger,
  actorId: string | null,
): Promise<void> {
  await prisma.donor.update({
    where: { id: donorId },
    data: { scoreRecalcRequired: true },
  });
  await audit.log({
    actorUserId: actorId,
    action: "seedscore.recalc.scheduled",
    entityType: "Donor",
    entityId: donorId,
    donorRelId: donorId,
    afterJson: { trigger },
  });
  await prisma.eventEmission.create({
    data: {
      eventName: "seedscore.recalc.pending",
      payload: { donorId, trigger, actorId } as Prisma.InputJsonValue,
      targetSystem: "INTERNAL",
      consumerStatus: "PENDING",
    },
  });
}

/**
 * Synchronous recalc: archive current → create new SeedScore + answers → update Donor.
 */
export async function runRecalc(
  donorId: string,
  trigger: RecalcTrigger,
  actorId: string,
  answers: AnswerInput[],
): Promise<{ scoreId: string; totalScore: number; tier: SeedScoreTier }> {
  if (answers.length === 0) {
    throw new Error("At least one answer required to compute SeedScore");
  }

  const donor = await prisma.donor.findUniqueOrThrow({ where: { id: donorId } });
  if (!shouldRecalculate(donor, trigger) && trigger !== RecalcTrigger.MANUAL_BRM) {
    throw new Error(`Recalc not indicated for trigger ${trigger}`);
  }

  const questionIds = answers.map((a) => a.questionId);
  const questions = await prisma.chakraQuestion.findMany({
    where: {
      id: { in: questionIds },
      donorType: donor.type,
      isActive: true,
    },
    include: { options: { where: { isActive: true } } },
  });
  if (questions.length !== new Set(questionIds).size) {
    throw new Error("One or more questions invalid for this donor type");
  }

  const qMap = new Map(questions.map((q) => [q.id, q]));
  const answered: Array<{ chakra: ChakraType; scoreValue: number }> = [];
  for (const a of answers) {
    const q = qMap.get(a.questionId);
    if (!q) throw new Error(`Unknown question ${a.questionId}`);
    const opt = q.options.find((o) => o.id === a.selectedOptionId);
    if (!opt) throw new Error(`Invalid option for question ${q.questionCode}`);
    answered.push({ chakra: q.chakra, scoreValue: opt.scoreValue });
  }

  // Prefer full active question counts per chakra for normalization
  const activeQs = await prisma.chakraQuestion.findMany({
    where: { donorType: donor.type, isActive: true },
    select: { chakra: true },
  });
  const questionCounts: Partial<Record<ChakraType, number>> = {};
  for (const q of activeQs) {
    questionCounts[q.chakra] = (questionCounts[q.chakra] ?? 0) + 1;
  }

  const { chakraScores, totalScore, tier } = scoreFromAnswers(
    answered,
    questionCounts,
  );

  const activeRubric = await prisma.rubricVersion.findFirst({
    where: { isActive: true },
    orderBy: { versionNumber: "desc" },
  });
  const rubricVersion = activeRubric
    ? `v${activeRubric.versionNumber}`
    : "draft";

  const existing = await prisma.seedScore.findUnique({
    where: { donorId },
    include: { answers: true },
  });

  let nextVersion = 1;
  if (existing) {
    const lastHist = await prisma.seedScoreHistory.findFirst({
      where: { donorId },
      orderBy: { versionNumber: "desc" },
    });
    nextVersion = (lastHist?.versionNumber ?? 0) + 1;

    // Clear pointer before delete (circular FK)
    await prisma.donor.update({
      where: { id: donorId },
      data: { currentSeedScoreId: null },
    });

    await prisma.seedScoreHistory.create({
      data: {
        donorId,
        versionNumber: nextVersion,
        totalScore: existing.totalScore,
        tier: existing.tier,
        rootScore: existing.rootScore,
        sacralScore: existing.sacralScore,
        solarPlexusScore: existing.solarPlexusScore,
        heartScore: existing.heartScore,
        throatScore: existing.throatScore,
        thirdEyeScore: existing.thirdEyeScore,
        crownScore: existing.crownScore,
        recalcTrigger: existing.recalcTrigger,
        computedAt: existing.computedAt,
        computedByUserId: existing.computedByUserId,
        rubricVersion: existing.rubricVersion,
        supersededAt: new Date(),
      },
    });

    await prisma.seedScoreAnswer.deleteMany({
      where: { seedScoreId: existing.id },
    });
    await prisma.seedScore.delete({ where: { id: existing.id } });
  }

  const score = await prisma.seedScore.create({
    data: {
      donorId,
      totalScore,
      tier,
      rootScore: chakraScores.ROOT,
      sacralScore: chakraScores.SACRAL,
      solarPlexusScore: chakraScores.SOLAR_PLEXUS,
      heartScore: chakraScores.HEART,
      throatScore: chakraScores.THROAT,
      thirdEyeScore: chakraScores.THIRD_EYE,
      crownScore: chakraScores.CROWN,
      recalcTrigger: trigger,
      computedByUserId: actorId,
      rubricVersion,
      answers: {
        create: answers.map((a) => ({
          questionId: a.questionId,
          selectedOptionId: a.selectedOptionId,
          notes: a.notes ?? null,
          answeredByUserId: actorId,
        })),
      },
    },
  });

  const now = new Date();
  await prisma.donor.update({
    where: { id: donorId },
    data: {
      currentSeedScoreId: score.id,
      currentTier: tier,
      firstScoredAt: donor.firstScoredAt ?? now,
      lastScoredAt: now,
      scoreRecalcRequired: false,
    },
  });

  // Patch history supersededBy
  if (existing) {
    await prisma.seedScoreHistory.updateMany({
      where: { donorId, versionNumber: nextVersion },
      data: { supersededByScoreId: score.id },
    });
  }

  await audit.log({
    actorUserId: actorId,
    action: "seedscore.compute",
    entityType: "SeedScore",
    entityId: score.id,
    donorRelId: donorId,
    afterJson: {
      totalScore,
      tier,
      trigger,
      rubricVersion,
      chakraScores,
      chakraOrder: CHAKRA_ORDER,
    },
  });

  return { scoreId: score.id, totalScore, tier };
}

/**
 * Manual tier override (edge cases) — updates Donor.currentTier + current SeedScore.tier.
 */
export async function overrideTier(
  donorId: string,
  tier: SeedScoreTier,
  actorId: string,
  reason: string,
): Promise<void> {
  const donor = await prisma.donor.findUniqueOrThrow({ where: { id: donorId } });
  const before = { currentTier: donor.currentTier };

  await prisma.donor.update({
    where: { id: donorId },
    data: { currentTier: tier },
  });

  if (donor.currentSeedScoreId) {
    await prisma.seedScore.update({
      where: { id: donor.currentSeedScoreId },
      data: { tier },
    });
  }

  await audit.log({
    actorUserId: actorId,
    action: "seedscore.override.tier",
    entityType: "Donor",
    entityId: donorId,
    donorRelId: donorId,
    beforeJson: before,
    afterJson: { currentTier: tier, reason },
  });
}
