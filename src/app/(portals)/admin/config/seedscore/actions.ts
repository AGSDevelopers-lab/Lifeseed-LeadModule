"use server";

import {
  ChakraType,
  DonorType,
  RecalcTrigger,
  SeedScoreTier,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import {
  overrideTier,
  runRecalc,
  type AnswerInput,
} from "@/lib/seedscore/recalc-engine";

export type SeedScoreActionResult =
  | { ok: true; id?: string; totalScore?: number; tier?: SeedScoreTier }
  | { ok: false; error: string; code?: string };

function catchPerm(err: unknown): SeedScoreActionResult {
  if (err instanceof Response) {
    return {
      ok: false,
      error: err.status === 401 ? "Unauthorized" : "Forbidden",
    };
  }
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: "Unexpected error" };
}

const optionSchema = z.object({
  optionCode: z.string().min(1),
  optionText: z.string().min(1),
  scoreValue: z.number().int().min(0).max(10),
  orderIndex: z.number().int().nonnegative(),
});

const questionSchema = z.object({
  chakra: z.nativeEnum(ChakraType),
  donorType: z.nativeEnum(DonorType),
  questionCode: z.string().min(1),
  questionText: z.string().min(1),
  orderIndex: z.number().int().nonnegative(),
  subDimension: z.string().optional().nullable(),
  options: z.array(optionSchema).min(1),
});

export async function createChakraQuestion(
  input: z.infer<typeof questionSchema>,
): Promise<SeedScoreActionResult> {
  try {
    const session = await requirePermission("seedscore.question.author");
    const parsed = questionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };
    const d = parsed.data;

    const q = await prisma.chakraQuestion.create({
      data: {
        chakra: d.chakra,
        donorType: d.donorType,
        questionCode: d.questionCode,
        questionText: d.questionText,
        orderIndex: d.orderIndex,
        subDimension: d.subDimension || null,
        createdByUserId: session.userId,
        options: {
          create: d.options.map((o) => ({
            optionCode: o.optionCode,
            optionText: o.optionText,
            scoreValue: o.scoreValue,
            orderIndex: o.orderIndex,
          })),
        },
      },
    });

    await audit.log({
      actorUserId: session.userId,
      action: "seedscore.question.create",
      entityType: "ChakraQuestion",
      entityId: q.id,
      afterJson: { questionCode: d.questionCode, chakra: d.chakra },
    });

    revalidatePath("/admin/config/seedscore");
    return { ok: true, id: q.id };
  } catch (err) {
    return catchPerm(err);
  }
}

const editSchema = questionSchema.extend({
  id: z.string().min(1),
  isActive: z.boolean().optional(),
});

export async function updateChakraQuestion(
  input: z.infer<typeof editSchema>,
): Promise<SeedScoreActionResult> {
  try {
    const session = await requirePermission("seedscore.question.author");
    const parsed = editSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };
    const d = parsed.data;

    await prisma.chakraRubricOption.deleteMany({
      where: { questionId: d.id },
    });

    await prisma.chakraQuestion.update({
      where: { id: d.id },
      data: {
        chakra: d.chakra,
        donorType: d.donorType,
        questionCode: d.questionCode,
        questionText: d.questionText,
        orderIndex: d.orderIndex,
        subDimension: d.subDimension || null,
        isActive: d.isActive ?? true,
        options: {
          create: d.options.map((o) => ({
            optionCode: o.optionCode,
            optionText: o.optionText,
            scoreValue: o.scoreValue,
            orderIndex: o.orderIndex,
          })),
        },
      },
    });

    await audit.log({
      actorUserId: session.userId,
      action: "seedscore.question.update",
      entityType: "ChakraQuestion",
      entityId: d.id,
      afterJson: { questionCode: d.questionCode, isActive: d.isActive },
    });

    revalidatePath("/admin/config/seedscore");
    revalidatePath(`/admin/config/seedscore/questions/${d.id}/edit`);
    return { ok: true, id: d.id };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function toggleQuestionActive(
  questionId: string,
  isActive: boolean,
): Promise<SeedScoreActionResult> {
  try {
    const session = await requirePermission("seedscore.rubric.author");
    await prisma.chakraQuestion.update({
      where: { id: questionId },
      data: { isActive },
    });
    await audit.log({
      actorUserId: session.userId,
      action: "seedscore.question.update",
      entityType: "ChakraQuestion",
      entityId: questionId,
      afterJson: { isActive },
    });
    revalidatePath("/admin/config/seedscore");
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function publishRubricVersion(
  notes?: string,
): Promise<SeedScoreActionResult> {
  try {
    const session = await requirePermission("seedscore.rubric.publish");
    const last = await prisma.rubricVersion.findFirst({
      orderBy: { versionNumber: "desc" },
    });
    const versionNumber = (last?.versionNumber ?? 0) + 1;

    await prisma.rubricVersion.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    const v = await prisma.rubricVersion.create({
      data: {
        versionNumber,
        publishedByUserId: session.userId,
        isActive: true,
        notes: notes || null,
      },
    });

    await prisma.donor.updateMany({
      where: { currentSeedScoreId: { not: null } },
      data: { scoreRecalcRequired: true },
    });

    await audit.log({
      actorUserId: session.userId,
      action: "seedscore.rubric.publish",
      entityType: "RubricVersion",
      entityId: v.id,
      afterJson: { versionNumber, notes: notes ?? null },
    });

    revalidatePath("/admin/config/seedscore");
    revalidatePath("/admin/config/seedscore/versions");
    return { ok: true, id: v.id };
  } catch (err) {
    return catchPerm(err);
  }
}

const computeSchema = z.object({
  donorId: z.string().min(1),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedOptionId: z.string().min(1),
        notes: z.string().optional().nullable(),
      }),
    )
    .min(1),
});

export async function computeDonorSeedScore(
  input: z.infer<typeof computeSchema>,
): Promise<SeedScoreActionResult> {
  try {
    const session = await requirePermission("seedscore.recalc.manual");
    const parsed = computeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };

    const result = await runRecalc(
      parsed.data.donorId,
      RecalcTrigger.MANUAL_BRM,
      session.userId,
      parsed.data.answers as AnswerInput[],
    );

    revalidatePath(`/admin/donors/${parsed.data.donorId}`);
    return {
      ok: true,
      id: result.scoreId,
      totalScore: result.totalScore,
      tier: result.tier,
    };
  } catch (err) {
    return catchPerm(err);
  }
}

const overrideSchema = z.object({
  donorId: z.string().min(1),
  tier: z.nativeEnum(SeedScoreTier),
  reason: z.string().min(3),
});

export async function overrideDonorTier(
  input: z.infer<typeof overrideSchema>,
): Promise<SeedScoreActionResult> {
  try {
    const session = await requirePermission("seedscore.override.tier");
    const parsed = overrideSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };

    await overrideTier(
      parsed.data.donorId,
      parsed.data.tier,
      session.userId,
      parsed.data.reason,
    );

    revalidatePath(`/admin/donors/${parsed.data.donorId}`);
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}

/** BRM gate override: advance P1→P2 despite NOT_RECOMMENDED when flag is on. */
export async function bypassSeedScoreGateAndAdvance(
  donorId: string,
  reason: string,
): Promise<SeedScoreActionResult> {
  try {
    const session = await requirePermission("seedscore.override.tier");
    if (!reason || reason.trim().length < 3) {
      return { ok: false, error: "Reason required" };
    }

    const { advancePhase } = await import("@/lib/donor-phase");
    const { DonorPhase } = await import("@prisma/client");

    await audit.log({
      actorUserId: session.userId,
      action: "seedscore.gate.override",
      entityType: "Donor",
      entityId: donorId,
      donorRelId: donorId,
      afterJson: { reason, bypass: true },
    });

    await advancePhase(donorId, DonorPhase.P2_ACTIVE, {
      actorUserId: session.userId,
      reason: `SeedScore gate override: ${reason}`,
      bypassSeedScoreGate: true,
    });

    revalidatePath(`/admin/donors/${donorId}`);
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}
