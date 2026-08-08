import { z } from "zod";
import {
  CycleEventType,
  CycleLocation,
  CycleOutcome,
  DrfState,
  EmbryoDisposition,
  OocyteMaturity,
  PgtResult,
  type Prisma,
} from "@prisma/client";

import { audit } from "@/lib/audit";
import { scheduleNudges } from "@/lib/embryology/outcome-nudge";
import { ensureEmbryoCohort } from "@/lib/embryology/cohort";
import { WITNESS_REQUIRED } from "@/lib/embryology/labels";
import { advanceDrf } from "@/lib/drf-state";
import { prisma } from "@/lib/db";
import { logAttestation } from "@/lib/witness";

export { WITNESS_REQUIRED } from "@/lib/embryology/labels";

export const PHASE_FOR_EVENT: Record<CycleEventType, string> = {
  STIM_MONITORING: "E1",
  OPU_COMPLETED: "E2",
  OOCYTES_RETRIEVED: "E3",
  FERTILIZATION: "E4",
  DAY1_CHECK: "E5",
  DAY3_GRADE: "E5",
  DAY5_GRADE: "E5",
  PGT_RESULT: "E5",
  TRANSFER: "E7",
  VITRIFICATION: "E8",
  BETA_HCG: "E9",
  CLINICAL_PREGNANCY: "E9",
  LIVE_BIRTH: "E9",
  CYCLE_CANCELLED: "E9",
};

/** Events allowed given current cohort phase (E0–E9). */
export function eventsForPhase(phase: string): CycleEventType[] {
  const order = ["E0", "E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9"];
  const idx = Math.max(0, order.indexOf(phase));
  const allowed: CycleEventType[] = [];
  for (const [evt, p] of Object.entries(PHASE_FOR_EVENT)) {
    const pi = order.indexOf(p);
    if (pi <= idx + 1) allowed.push(evt as CycleEventType);
  }
  // Always allow stim from E0/E1 and outcome events late
  return [...new Set(allowed)];
}

const embryoGradeSchema = z.object({
  oocyteId: z.string().min(1),
  oocyteMaturity: z.nativeEnum(OocyteMaturity).optional(),
  day1_2pn: z.boolean().optional(),
  day3Grade: z.string().optional(),
  day5Gardner: z.string().optional(),
  pgtResult: z.nativeEnum(PgtResult).optional(),
  disposition: z.nativeEnum(EmbryoDisposition).optional(),
  storageRef: z.string().optional(),
});

export const eventPayloadSchemas: Record<CycleEventType, z.ZodType> = {
  STIM_MONITORING: z.object({
    stimDay: z.number().int().min(1),
    follicleCount: z.number().int().nonnegative(),
    leadFollicleMm: z.number().optional(),
    e2PgMl: z.number().optional(),
    notes: z.string().optional(),
  }),
  OPU_COMPLETED: z.object({
    folliclesAspirated: z.number().int().nonnegative(),
    oocytesRetrieved: z.number().int().nonnegative(),
    complications: z.string().optional(),
  }),
  OOCYTES_RETRIEVED: z.object({
    oocytesRetrieved: z.number().int().nonnegative(),
    miiCount: z.number().int().nonnegative(),
    miCount: z.number().int().nonnegative().optional(),
    gvCount: z.number().int().nonnegative().optional(),
    oocytes: z
      .array(
        z.object({
          oocyteId: z.string().min(1),
          maturity: z.nativeEnum(OocyteMaturity),
        }),
      )
      .optional(),
  }),
  FERTILIZATION: z.object({
    method: z.enum(["ICSI", "IVF", "IVF_ICSI"]),
    spermSource: z.enum(["DONOR_VIAL", "PARTNER", "MIXED"]),
    vialsUsed: z.array(z.string()).optional(),
    oocytesInseminated: z.number().int().nonnegative(),
  }),
  DAY1_CHECK: z.object({
    twoPnCount: z.number().int().nonnegative(),
    embryos: z.array(embryoGradeSchema).optional(),
  }),
  DAY3_GRADE: z.object({
    cleavedCount: z.number().int().nonnegative(),
    embryos: z.array(embryoGradeSchema).optional(),
  }),
  DAY5_GRADE: z.object({
    blastCount: z.number().int().nonnegative(),
    embryos: z
      .array(
        embryoGradeSchema.extend({
          day5Gardner: z.string().min(2),
        }),
      )
      .optional(),
  }),
  PGT_RESULT: z.object({
    embryos: z.array(
      z.object({
        oocyteId: z.string().min(1),
        pgtResult: z.nativeEnum(PgtResult),
      }),
    ),
  }),
  TRANSFER: z.object({
    embryoIds: z.array(z.string()).min(1),
    catheterLot: z.string().optional(),
    difficulty: z.enum(["EASY", "MODERATE", "DIFFICULT"]).optional(),
    transferredAt: z.string().optional(),
  }),
  VITRIFICATION: z.object({
    embryoIds: z.array(z.string()).min(1),
    storageRef: z.string().optional(),
    device: z.string().optional(),
  }),
  BETA_HCG: z.object({
    result: z.enum(["POSITIVE", "NEGATIVE", "INCONCLUSIVE"]),
    valueMiuMl: z.number().optional(),
    testedAt: z.string().optional(),
  }),
  CLINICAL_PREGNANCY: z.object({
    sacCount: z.number().int().positive().optional(),
    fetalHeart: z.boolean().optional(),
    notes: z.string().optional(),
  }),
  LIVE_BIRTH: z.object({
    births: z.number().int().min(1).optional(),
    gestationalAgeWeeks: z.number().optional(),
    notes: z.string().optional(),
  }),
  CYCLE_CANCELLED: z.object({
    reason: z.string().min(1),
  }),
};

export type RecordEventInput = {
  drfId: string;
  eventType: CycleEventType;
  payload: unknown;
  actorUserId: string;
  clinicId: string;
  location?: CycleLocation;
  occurredAt?: Date;
  witnessUserId?: string;
};

async function upsertEmbryos(
  cohortId: string,
  rows: Array<z.infer<typeof embryoGradeSchema>>,
) {
  for (const row of rows) {
    await prisma.embryo.upsert({
      where: { oocyteId: row.oocyteId },
      create: {
        cohortId,
        oocyteId: row.oocyteId,
        oocyteRef: row.oocyteId,
        oocyteMaturity: row.oocyteMaturity,
        day1_2pn: row.day1_2pn,
        day3Grade: row.day3Grade,
        day5Gardner: row.day5Gardner,
        pgtResult: row.pgtResult,
        disposition: row.disposition ?? EmbryoDisposition.CULTURE,
        storageRef: row.storageRef,
      },
      update: {
        oocyteMaturity: row.oocyteMaturity,
        day1_2pn: row.day1_2pn,
        day3Grade: row.day3Grade,
        day5Gardner: row.day5Gardner,
        pgtResult: row.pgtResult,
        disposition: row.disposition,
        storageRef: row.storageRef,
      },
    });
  }
}

export async function recordEvent(input: RecordEventInput) {
  const schema = eventPayloadSchemas[input.eventType];
  const parsed = schema.safeParse(input.payload);
  if (!parsed.success) {
    throw new Error(`Invalid payload for ${input.eventType}`);
  }
  const payload = parsed.data as Record<string, unknown>;

  if (WITNESS_REQUIRED.includes(input.eventType)) {
    if (!input.witnessUserId) {
      throw new Error(`2-witness required for ${input.eventType}`);
    }
    await logAttestation({
      action: `cycle_${input.eventType.toLowerCase()}`,
      entityType: "DRF",
      entityId: input.drfId,
      primaryUserId: input.actorUserId,
      witnessUserId: input.witnessUserId,
    });
  }

  const cohortId = await ensureEmbryoCohort(input.drfId);
  const location = input.location ?? CycleLocation.L2;
  const occurredAt = input.occurredAt ?? new Date();

  const event = await prisma.cycleEvent.create({
    data: {
      drfId: input.drfId,
      eventType: input.eventType,
      occurredAt,
      payload: payload as Prisma.InputJsonValue,
      actorUserId: input.actorUserId,
      clinicId: input.clinicId,
      location,
    },
  });

  const cohortUpdate: Prisma.EmbryoCohortUpdateInput = {
    currentPhase: PHASE_FOR_EVENT[input.eventType],
  };

  switch (input.eventType) {
    case CycleEventType.OPU_COMPLETED: {
      cohortUpdate.opuAt = occurredAt;
      cohortUpdate.oocytesRetrieved = Number(payload.oocytesRetrieved);
      cohortUpdate.totalOocytesRetrieved = Number(payload.oocytesRetrieved);
      break;
    }
    case CycleEventType.OOCYTES_RETRIEVED: {
      cohortUpdate.oocytesRetrieved = Number(payload.oocytesRetrieved);
      cohortUpdate.totalOocytesRetrieved = Number(payload.oocytesRetrieved);
      cohortUpdate.miiCount = Number(payload.miiCount);
      if (payload.miCount != null) cohortUpdate.miCount = Number(payload.miCount);
      if (payload.gvCount != null) cohortUpdate.gvCount = Number(payload.gvCount);
      if (Array.isArray(payload.oocytes)) {
        await upsertEmbryos(
          cohortId,
          (payload.oocytes as Array<{ oocyteId: string; maturity: OocyteMaturity }>).map(
            (o) => ({
              oocyteId: o.oocyteId,
              oocyteMaturity: o.maturity,
            }),
          ),
        );
      }
      break;
    }
    case CycleEventType.DAY1_CHECK: {
      cohortUpdate.day1_2pnCount = Number(payload.twoPnCount);
      if (Array.isArray(payload.embryos)) {
        await upsertEmbryos(
          cohortId,
          payload.embryos as z.infer<typeof embryoGradeSchema>[],
        );
      }
      break;
    }
    case CycleEventType.DAY3_GRADE: {
      cohortUpdate.day3CleavedCount = Number(payload.cleavedCount);
      if (Array.isArray(payload.embryos)) {
        await upsertEmbryos(
          cohortId,
          payload.embryos as z.infer<typeof embryoGradeSchema>[],
        );
      }
      break;
    }
    case CycleEventType.DAY5_GRADE: {
      cohortUpdate.day5BlastCount = Number(payload.blastCount);
      if (Array.isArray(payload.embryos)) {
        await upsertEmbryos(
          cohortId,
          payload.embryos as z.infer<typeof embryoGradeSchema>[],
        );
      }
      break;
    }
    case CycleEventType.PGT_RESULT: {
      if (Array.isArray(payload.embryos)) {
        for (const e of payload.embryos as Array<{
          oocyteId: string;
          pgtResult: PgtResult;
        }>) {
          await prisma.embryo.updateMany({
            where: { oocyteId: e.oocyteId, cohortId },
            data: { pgtResult: e.pgtResult, pgtTriggered: true },
          });
        }
      }
      break;
    }
    case CycleEventType.TRANSFER: {
      const ids = payload.embryoIds as string[];
      await prisma.embryo.updateMany({
        where: {
          cohortId,
          OR: [{ id: { in: ids } }, { oocyteId: { in: ids } }],
        },
        data: {
          disposition: EmbryoDisposition.TRANSFERRED,
          transferredAt: occurredAt,
        },
      });
      const count = await prisma.embryo.count({
        where: { cohortId, disposition: EmbryoDisposition.TRANSFERRED },
      });
      cohortUpdate.transferredCount = count;
      await scheduleNudges(input.drfId, occurredAt);
      // Ensure DRF is IN_CYCLE
      const drf = await prisma.dRF.findUniqueOrThrow({
        where: { id: input.drfId },
      });
      if (drf.state === DrfState.DELIVERED) {
        await advanceDrf(input.drfId, DrfState.IN_CYCLE, {
          actorUserId: input.actorUserId,
          reason: "Transfer logged — cycle in progress",
        });
      }
      break;
    }
    case CycleEventType.VITRIFICATION: {
      const ids = payload.embryoIds as string[];
      await prisma.embryo.updateMany({
        where: {
          cohortId,
          OR: [{ id: { in: ids } }, { oocyteId: { in: ids } }],
        },
        data: {
          disposition: EmbryoDisposition.VITRIFIED,
          storageRef: (payload.storageRef as string) || undefined,
        },
      });
      cohortUpdate.vitrifiedCount = await prisma.embryo.count({
        where: { cohortId, disposition: EmbryoDisposition.VITRIFIED },
      });
      break;
    }
    case CycleEventType.BETA_HCG: {
      const result = String(payload.result);
      if (result === "NEGATIVE") {
        cohortUpdate.outcome = CycleOutcome.NOT_PREGNANT;
        cohortUpdate.outcomeReportedAt = occurredAt;
        cohortUpdate.closedAt = occurredAt;
        await closeDrfOutcome(
          input.drfId,
          input.actorUserId,
          CycleOutcome.NOT_PREGNANT,
          "Beta-hCG negative",
        );
      } else if (result === "POSITIVE") {
        await advanceDrf(input.drfId, DrfState.OUTCOME_PENDING, {
          actorUserId: input.actorUserId,
          reason: "Beta-hCG positive — awaiting clinical pregnancy / birth",
          data: { outcomeType: "BETA_HCG_POS" },
        }).catch(async () => {
          // Already OUTCOME_PENDING or past — ok
        });
      }
      break;
    }
    case CycleEventType.CLINICAL_PREGNANCY: {
      await advanceDrf(input.drfId, DrfState.OUTCOME_PENDING, {
        actorUserId: input.actorUserId,
        reason: "Clinical pregnancy reported",
        data: { outcomeType: "CLINICAL_PREGNANCY" },
      }).catch(() => undefined);
      break;
    }
    case CycleEventType.LIVE_BIRTH: {
      cohortUpdate.outcome = CycleOutcome.PREGNANT;
      cohortUpdate.outcomeReportedAt = occurredAt;
      cohortUpdate.closedAt = occurredAt;
      await closeDrfOutcome(
        input.drfId,
        input.actorUserId,
        CycleOutcome.PREGNANT,
        "Live birth",
      );
      const births = Number(payload.births ?? 1);
      const drf = await prisma.dRF.findUnique({
        where: { id: input.drfId },
      });
      if (drf?.allocatedDonorId) {
        await prisma.donor.update({
          where: { id: drf.allocatedDonorId },
          data: { cumulativePregnancies: { increment: births } },
        });
      }
      break;
    }
    case CycleEventType.CYCLE_CANCELLED: {
      cohortUpdate.outcome = CycleOutcome.CANCELLED;
      cohortUpdate.closedAt = occurredAt;
      await closeDrfOutcome(
        input.drfId,
        input.actorUserId,
        CycleOutcome.CANCELLED,
        String(payload.reason),
      );
      break;
    }
    default:
      break;
  }

  await prisma.embryoCohort.update({
    where: { id: cohortId },
    data: cohortUpdate,
  });

  await audit.log({
    actorUserId: input.actorUserId,
    action: "CREATE",
    entityType: "CycleEvent",
    entityId: event.id,
    afterJson: {
      drfId: input.drfId,
      eventType: input.eventType,
      location,
    },
  });

  return event;
}

async function closeDrfOutcome(
  drfId: string,
  actorUserId: string,
  outcome: CycleOutcome,
  reason: string,
) {
  const drf = await prisma.dRF.findUniqueOrThrow({ where: { id: drfId } });
  if (drf.state === DrfState.CLOSED || drf.state === DrfState.CANCELLED) return;

  if (drf.state === DrfState.IN_CYCLE) {
    await advanceDrf(drfId, DrfState.OUTCOME_PENDING, {
      actorUserId,
      reason,
      data: { outcomeType: outcome },
    });
  }
  if (
    (await prisma.dRF.findUniqueOrThrow({ where: { id: drfId } })).state ===
    DrfState.OUTCOME_PENDING
  ) {
    await advanceDrf(drfId, DrfState.CLOSED, {
      actorUserId,
      reason,
      data: { outcomeType: outcome, outcomeReportedAt: new Date() },
    });
  }
}
