"use server";

import {
  SampleCategory,
  SampleGrade,
  SamplePriority,
  SampleReleaseTiming,
  SampleState,
  SampleType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  advanceSample,
  nextSampleCode,
  runQcGate,
} from "@/lib/sample-state";
import { requirePermission } from "@/lib/rbac";
import { logAttestation } from "@/lib/witness";

export type ActionResult =
  | { ok: true; id?: string; passed?: boolean }
  | { ok: false; error: string };

function catchPerm(err: unknown): ActionResult {
  if (err instanceof Response) {
    return {
      ok: false,
      error: err.status === 401 ? "Unauthorized" : "Forbidden",
    };
  }
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: "Unexpected error" };
}

const accessionSchema = z.object({
  donorId: z.string().min(1),
  siteId: z.string().min(1),
  priority: z.nativeEnum(SamplePriority),
  releaseTiming: z.nativeEnum(SampleReleaseTiming),
  collectionDate: z.string().min(1),
  collectionTime: z.string().min(1),
  abstinenceDays: z.number().int().min(2).max(7),
  deliveredToLabAt: z.string().optional(),
  containerIntact: z.boolean(),
  idMatch: z.boolean(),
  timeUnder30min: z.boolean(),
  completeEjaculate: z.boolean(),
  notes: z.string().optional(),
  category: z.nativeEnum(SampleCategory).optional(),
});

export async function accessionSample(
  input: z.infer<typeof accessionSchema>,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("sample.accession");
    const parsed = accessionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };
    const d = parsed.data;

    if (
      !d.containerIntact ||
      !d.idMatch ||
      !d.timeUnder30min ||
      !d.completeEjaculate
    ) {
      return {
        ok: false,
        error: "QC-A1 failed — all accession checks must pass",
      };
    }

    const category = d.category ?? SampleCategory.STANDARD;
    const sampleCode = await nextSampleCode(d.siteId, category);

    const sample = await prisma.sample.create({
      data: {
        sampleCode,
        donorId: d.donorId,
        siteId: d.siteId,
        priority: d.priority,
        releaseTiming: d.releaseTiming,
        sampleType:
          d.releaseTiming === SampleReleaseTiming.QUARANTINE
            ? SampleType.QUARANTINE
            : SampleType.REGULAR,
        collectionDate: new Date(d.collectionDate),
        collectionTime: d.collectionTime,
        abstinenceDays: d.abstinenceDays,
        deliveredToLabAt: d.deliveredToLabAt
          ? new Date(d.deliveredToLabAt)
          : null,
        notes: d.notes || null,
        category,
        qcA1ContainerIntact: d.containerIntact,
        qcA1IdMatch: d.idMatch,
        qcA1TimeUnder30: d.timeUnder30min,
        qcA1CompleteEjaculate: d.completeEjaculate,
        state: SampleState.ACCESSIONED,
      },
    });

    await runQcGate(
      sample,
      1,
      {
        containerIntact: d.containerIntact,
        idMatch: d.idMatch,
        timeUnder30min: d.timeUnder30min,
        completeEjaculate: d.completeEjaculate,
      },
      session.userId,
    );

    await audit.log({
      actorUserId: session.userId,
      action: "sample.accessioned",
      entityType: "Sample",
      entityId: sample.id,
      sampleRelId: sample.id,
      afterJson: {
        sampleCode: sample.sampleCode,
        priority: sample.priority,
        releaseTiming: sample.releaseTiming,
      },
    });

    revalidatePath("/admin/samples");
    return { ok: true, id: sample.id };
  } catch (err) {
    return catchPerm(err);
  }
}

const analyzeSchema = z.object({
  sampleId: z.string().min(1),
  volumeML: z.number().positive(),
  ph: z.number().positive(),
  viscosity: z.string().optional(),
  liquefactionTimeMin: z.number().int().optional(),
  concentrationMPerML: z.number().nonnegative(),
  progressiveMotilityPct: z.number().min(0).max(100),
  totalMotilityPct: z.number().min(0).max(100),
  morphologyNormalPct: z.number().min(0).max(100),
  vitalityPct: z.number().min(0).max(100),
  analysisVideoUrl: z.string().url().optional().or(z.literal("")),
});

export async function analyzeSample(
  input: z.infer<typeof analyzeSchema>,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("sample.analyze");
    const parsed = analyzeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };
    const d = parsed.data;

    const totalMotile = d.concentrationMPerML * d.volumeML;

    const sample = await prisma.sample.update({
      where: { id: d.sampleId },
      data: {
        volumeML: d.volumeML,
        ph: d.ph,
        viscosity: d.viscosity || null,
        liquefactionTimeMin: d.liquefactionTimeMin ?? null,
        concentrationMPerML: d.concentrationMPerML,
        progressiveMotilityPct: d.progressiveMotilityPct,
        totalMotilityPct: d.totalMotilityPct,
        morphologyNormalPct: d.morphologyNormalPct,
        vitalityPct: d.vitalityPct,
        totalSpermsMillion: totalMotile,
        totalMotileSpermsMillion:
          (totalMotile * d.totalMotilityPct) / 100,
        analysisVideoUrl: d.analysisVideoUrl || null,
      },
    });

    const qc = await runQcGate(
      sample,
      2,
      {
        volumeML: d.volumeML,
        concentrationMPerML: d.concentrationMPerML,
        progressiveMotilityPct: d.progressiveMotilityPct,
        totalMotilityPct: d.totalMotilityPct,
        morphologyNormalPct: d.morphologyNormalPct,
        vitalityPct: d.vitalityPct,
      },
      session.userId,
    );

    await advanceSample(sample.id, SampleState.ANALYZED, {
      actorUserId: session.userId,
      reason: qc.passed ? "QC-A2 passed" : "QC-A2 failed — recorded",
    });

    revalidatePath(`/admin/samples/${sample.id}`);
    return { ok: true, id: sample.id, passed: qc.passed };
  } catch (err) {
    return catchPerm(err);
  }
}

const qcA5Schema = z.object({
  sampleId: z.string().min(1),
  postThawPR: z.number().min(0).max(100),
  totalMotilePerVial: z.number().nonnegative(),
  postThawVideoUrl: z.string().optional(),
  qrPackUrl: z.string().optional(),
  witnessUserId: z.string().min(1),
});

export async function submitQcA5(
  input: z.infer<typeof qcA5Schema>,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("sample.qc");
    const parsed = qcA5Schema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };
    const d = parsed.data;

    await logAttestation({
      action: "qc_a5_test_vial_thaw",
      sampleId: d.sampleId,
      primaryUserId: session.userId,
      witnessUserId: d.witnessUserId,
    });

    const sample = await prisma.sample.update({
      where: { id: d.sampleId },
      data: {
        testVialThawResult: d.postThawPR,
        postThawVideoUrl: d.postThawVideoUrl || null,
        qrPackUrl: d.qrPackUrl || null,
      },
    });

    const qc = await runQcGate(
      sample,
      5,
      {
        postThawPR: d.postThawPR,
        totalMotilePerVial: d.totalMotilePerVial,
      },
      session.userId,
    );

    // Grade from recovery vs pre-freeze
    const pre = sample.progressiveMotilityPct ?? 0;
    const recovery = pre > 0 ? (d.postThawPR / pre) * 100 : 0;
    let grade: SampleGrade | null = null;
    if (recovery >= 60) grade = SampleGrade.A;
    else if (recovery >= 50) grade = SampleGrade.B;
    else if (recovery >= 40) grade = SampleGrade.C;
    else grade = SampleGrade.REJECTED;

    if (!qc.passed || grade === SampleGrade.REJECTED) {
      await advanceSample(sample.id, SampleState.CLOSED, {
        actorUserId: session.userId,
        reason: "QC-A5 failed — batch destroy",
        data: { grade },
        witnesses: [session.userId, d.witnessUserId],
      });
      return { ok: true, passed: false };
    }

    await prisma.sample.update({
      where: { id: sample.id },
      data: { grade },
    });

    const next =
      sample.releaseTiming === SampleReleaseTiming.QUARANTINE
        ? SampleState.QUARANTINE
        : SampleState.POST_THAW_ANALYZED;

    // Ensure state is QC_A5_PENDING or CRYOPRESERVED before advancing
    if (sample.state === SampleState.CRYOPRESERVED) {
      await advanceSample(sample.id, SampleState.QC_A5_PENDING, {
        actorUserId: session.userId,
        reason: "Enter QC-A5 evaluation",
      });
    }

    await advanceSample(sample.id, next, {
      actorUserId: session.userId,
      reason: "QC-A5 passed",
      witnesses: [session.userId, d.witnessUserId],
    });

    revalidatePath(`/admin/samples/${sample.id}`);
    return { ok: true, passed: true };
  } catch (err) {
    return catchPerm(err);
  }
}

const postThawSchema = z.object({
  sampleId: z.string().min(1),
  postThawConcentration: z.number().optional(),
  postThawRapidPRPct: z.number().optional(),
  postThawSlowPRPct: z.number().optional(),
  postThawNonProgPct: z.number().optional(),
  postThawVitalityPct: z.number().optional(),
  postThawMorphologyPct: z.number().optional(),
  postThawVolumeML: z.number().optional(),
});

export async function submitPostThaw(
  input: z.infer<typeof postThawSchema>,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("sample.post_thaw");
    const parsed = postThawSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };
    const d = parsed.data;

    const conc = d.postThawConcentration ?? 0;
    const vol = d.postThawVolumeML ?? 0.5;
    const rapid = d.postThawRapidPRPct ?? 0;
    const slow = d.postThawSlowPRPct ?? 0;
    const nonProg = d.postThawNonProgPct ?? 0;
    const progressive = rapid + slow;
    const totalMot = progressive + nonProg;
    const totalSperm = conc * vol;
    const totalRapidMotile = (totalSperm * rapid) / 100;

    const sample = await prisma.sample.update({
      where: { id: d.sampleId },
      data: {
        postThawConcentration: d.postThawConcentration ?? null,
        postThawRapidPRPct: d.postThawRapidPRPct ?? null,
        postThawSlowPRPct: d.postThawSlowPRPct ?? null,
        postThawNonProgPct: d.postThawNonProgPct ?? null,
        postThawVitalityPct: d.postThawVitalityPct ?? null,
        postThawMorphologyPct: d.postThawMorphologyPct ?? null,
        postThawVolumeML: d.postThawVolumeML ?? null,
        // derived snapshots on main motility fields for inventory
        rapidPRPct: rapid,
        slowPRPct: slow,
        progressiveMotilityPct: progressive,
        totalMotilityPct: totalMot,
        immotilePct: Math.max(0, 100 - totalMot),
        totalSpermsMillion: totalSperm,
        totalRapidMotileSpermsMillion: totalRapidMotile,
      },
    });

    if (
      sample.state === SampleState.QUARANTINE ||
      sample.state === SampleState.QC_A5_PENDING
    ) {
      await advanceSample(sample.id, SampleState.POST_THAW_ANALYZED, {
        actorUserId: session.userId,
        reason: "Post-thaw 9-parameter analysis recorded",
      });
    }

    revalidatePath(`/admin/samples/${sample.id}`);
    return { ok: true, id: sample.id };
  } catch (err) {
    return catchPerm(err);
  }
}

const moveSchema = z.object({
  vialIds: z.array(z.string()).min(1),
  tankId: z.string().min(1),
  canisterCode: z.string().min(1),
  rackCode: z.string().min(1),
  positionCode: z.string().optional(),
  witnessUserId: z.string().min(1),
});

export async function bulkMoveVials(
  input: z.infer<typeof moveSchema>,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("sample.move");
    const parsed = moveSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };
    const d = parsed.data;

    const vials = await prisma.vial.findMany({
      where: { id: { in: d.vialIds } },
      include: { tank: true },
    });
    if (vials.length === 0) return { ok: false, error: "No vials found" };

    const sampleId = vials[0].sampleId;
    await logAttestation({
      action: "tank_move",
      sampleId,
      primaryUserId: session.userId,
      witnessUserId: d.witnessUserId,
    });

    const tank = await prisma.cryoTank.findUniqueOrThrow({
      where: { id: d.tankId },
    });

    await prisma.vial.updateMany({
      where: { id: { in: d.vialIds } },
      data: {
        tankId: d.tankId,
        canisterCode: d.canisterCode,
        rackCode: d.rackCode,
        positionCode: d.positionCode || null,
        isQuarantined: tank.isQuarantine,
      },
    });

    await audit.log({
      actorUserId: session.userId,
      action: "UPDATE",
      entityType: "Vial",
      entityId: d.vialIds.join(","),
      sampleRelId: sampleId,
      afterJson: {
        tankId: d.tankId,
        canisterCode: d.canisterCode,
        rackCode: d.rackCode,
        witnessUserId: d.witnessUserId,
      },
    });

    revalidatePath("/admin/cryobank");
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function markCryopreserved(sampleId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("sample.cryo");
    await advanceSample(sampleId, SampleState.CRYOPRESERVED, {
      actorUserId: session.userId,
      reason: "Cryopreservation protocol complete",
      data: { cryoDate: new Date() },
    });
    await advanceSample(sampleId, SampleState.QC_A5_PENDING, {
      actorUserId: session.userId,
      reason: "Awaiting 24-hour QC-A5",
    });
    revalidatePath(`/admin/samples/${sampleId}`);
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function saveAdvancedTests(input: {
  sampleId: string;
  dfiPct?: number;
  marTestPct?: number;
  dsDnaBreakPct?: number;
  semenCultureResult?: string;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("sample.analyze");
    await prisma.sample.update({
      where: { id: input.sampleId },
      data: {
        dfiPct: input.dfiPct ?? null,
        marTestPct: input.marTestPct ?? null,
        dsDnaBreakPct: input.dsDnaBreakPct ?? null,
        semenCultureResult: input.semenCultureResult || null,
      },
    });
    await advanceSample(input.sampleId, SampleState.ADVANCED_TESTING, {
      actorUserId: session.userId,
      reason: "Advanced tests recorded",
    });
    revalidatePath(`/admin/samples/${input.sampleId}`);
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function decideSample(input: {
  sampleId: string;
  decisionOutcome: "DISCARD" | "RESCHEDULE" | "PROCEED";
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("sample.prep");
    if (input.decisionOutcome === "DISCARD") {
      await advanceSample(input.sampleId, SampleState.CLOSED, {
        actorUserId: session.userId,
        reason: "Decision: discard",
        data: { decisionOutcome: "DISCARD" },
      });
    } else if (input.decisionOutcome === "RESCHEDULE") {
      await prisma.sample.update({
        where: { id: input.sampleId },
        data: { decisionOutcome: "RESCHEDULE" },
      });
      await audit.log({
        actorUserId: session.userId,
        action: "UPDATE",
        entityType: "Sample",
        entityId: input.sampleId,
        sampleRelId: input.sampleId,
        afterJson: { decisionOutcome: "RESCHEDULE" },
      });
    } else {
      await advanceSample(input.sampleId, SampleState.DECIDED, {
        actorUserId: session.userId,
        reason: "Decision: proceed to preparation",
        data: { decisionOutcome: "PROCEED" },
      });
    }
    revalidatePath(`/admin/samples/${input.sampleId}`);
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function prepareSample(input: {
  sampleId: string;
  prepMethod: string;
  postPrepMotilityPct?: number;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("sample.prep");
    const sample = await prisma.sample.update({
      where: { id: input.sampleId },
      data: {
        prepMethod: input.prepMethod,
        postPrepMotilityPct: input.postPrepMotilityPct ?? null,
        preppedAt: new Date(),
      },
    });
    await runQcGate(
      sample,
      3,
      {
        passed: true,
        postPrepMotilityPct: input.postPrepMotilityPct,
        prepMethod: input.prepMethod,
      },
      session.userId,
    );
    await advanceSample(input.sampleId, SampleState.PREPARED, {
      actorUserId: session.userId,
      reason: "Preparation complete (QC-A3)",
    });
    revalidatePath(`/admin/samples/${input.sampleId}`);
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function createSampleVials(input: {
  sampleId: string;
  vialCount: number;
  volumeML: number;
  witnessUserId: string;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("sample.vial");
    const sample = await prisma.sample.findUniqueOrThrow({
      where: { id: input.sampleId },
    });

    await logAttestation({
      action: "vial_labeling",
      sampleId: input.sampleId,
      primaryUserId: session.userId,
      witnessUserId: input.witnessUserId,
    });

    const mapping = await prisma.categoryRuleConfig.findUnique({
      where: { siteId: sample.siteId },
    });
    const tanks = (mapping?.tankMappingJson ?? {}) as Record<
      string,
      string | null
    >;
    const useQuarantine =
      sample.releaseTiming === SampleReleaseTiming.QUARANTINE;
    let tankId = useQuarantine
      ? tanks.QUARANTINE
      : tanks[sample.category ?? "STANDARD"];

    if (!tankId) {
      const fallback = await prisma.cryoTank.findFirst({
        where: useQuarantine ? { isQuarantine: true } : {},
        orderBy: { tankCode: "asc" },
      });
      if (!fallback) return { ok: false, error: "No cryo tank available" };
      tankId = fallback.id;
    }

    const prefix = sample.sampleCode;
    const created = [];
    for (let i = 1; i <= input.vialCount; i++) {
      const vial = await prisma.vial.create({
        data: {
          vialCode: `${prefix}-V${String(i).padStart(2, "0")}`,
          sampleId: sample.id,
          volumeML: input.volumeML,
          tankId,
          canisterCode: "C1",
          rackCode: useQuarantine ? "Q-R1" : "R1",
          positionCode: String(i),
          category: sample.category,
          grade: sample.grade,
          isQuarantined: useQuarantine,
        },
      });
      created.push(vial.id);
    }

    await runQcGate(
      sample,
      4,
      { vialCount: input.vialCount, volumeML: input.volumeML, passed: true },
      session.userId,
    );

    await advanceSample(input.sampleId, SampleState.VIALED, {
      actorUserId: session.userId,
      reason: "Vials created (QC-A4)",
      witnesses: [session.userId, input.witnessUserId],
    });

    await audit.log({
      actorUserId: session.userId,
      action: "CREATE",
      entityType: "Vial",
      entityId: created.join(","),
      sampleRelId: sample.id,
      afterJson: { count: created.length, tankId },
    });

    revalidatePath(`/admin/samples/${input.sampleId}`);
    revalidatePath("/admin/cryobank");
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function completeQuarantineQcA6(input: {
  sampleId: string;
  serology: Record<string, string>;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("sample.qc");
    const sample = await prisma.sample.findUniqueOrThrow({
      where: { id: input.sampleId },
    });

    const qc = await runQcGate(sample, 6, input.serology, session.userId);
    if (!qc.passed) {
      await advanceSample(sample.id, SampleState.CLOSED, {
        actorUserId: session.userId,
        reason: "QC-A6 failed — serology positive",
        data: { postQuarantineSerologyPass: false },
      });
      return { ok: true, passed: false };
    }

    await prisma.sample.update({
      where: { id: sample.id },
      data: { postQuarantineSerologyPass: true },
    });

    // Auto-relocate vials from quarantine dewar to category default
    const mapping = await prisma.categoryRuleConfig.findUnique({
      where: { siteId: sample.siteId },
    });
    const tanks = (mapping?.tankMappingJson ?? {}) as Record<
      string,
      string | null
    >;
    const targetTankId = tanks[sample.category ?? "STANDARD"];
    if (targetTankId) {
      await prisma.vial.updateMany({
        where: { sampleId: sample.id, isDiscarded: false },
        data: {
          tankId: targetTankId,
          isQuarantined: false,
          isReleased: true,
          releasedAt: new Date(),
        },
      });
    }

    await advanceSample(sample.id, SampleState.POST_THAW_ANALYZED, {
      actorUserId: session.userId,
      reason: "QC-A6 passed — quarantine cleared",
    });

    revalidatePath(`/admin/samples/${sample.id}`);
    revalidatePath("/admin/cryobank");
    return { ok: true, passed: true };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function markDay165Notified(sampleId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("sample.qc");
    const sample = await prisma.sample.findUniqueOrThrow({
      where: { id: sampleId },
    });
    if (!sample.quarantineStartDate) {
      return { ok: false, error: "Sample not in quarantine" };
    }
    const day165 = new Date(sample.quarantineStartDate);
    day165.setUTCDate(day165.getUTCDate() + 165);
    if (Date.now() < day165.getTime()) {
      return { ok: false, error: "Day-165 not yet reached" };
    }

    await prisma.sample.update({
      where: { id: sampleId },
      data: { day165NotifiedAt: new Date() },
    });
    await audit.log({
      actorUserId: session.userId,
      action: "NOTIFY",
      entityType: "Sample",
      entityId: sampleId,
      sampleRelId: sampleId,
      afterJson: {
        event: "day165_donor_recall",
        channels: ["donor_portal", "sms"],
      },
    });
    revalidatePath(`/admin/samples/${sampleId}`);
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}
