import type { Embryo, EmbryoCohort } from "@prisma/client";

export type ViennaThresholds = {
  fertRate: number;
  cleavageRate: number;
  blastRate: number;
  goodBlastRate: number;
  vitrificationSurvival: number;
  implantationRate: number;
};

export const DEFAULT_VIENNA_THRESHOLDS: ViennaThresholds = {
  fertRate: 70,
  cleavageRate: 90,
  blastRate: 50,
  goodBlastRate: 40,
  vitrificationSurvival: 95,
  implantationRate: 40,
};

/** Gardner ≥3BB: expansion grade ≥3 and both ICM/TE in {A,B}. */
export function isGoodBlast(gardner: string | null | undefined): boolean {
  if (!gardner || gardner.length < 3) return false;
  const exp = Number(gardner[0]);
  const icm = gardner[1]?.toUpperCase();
  const te = gardner[2]?.toUpperCase();
  if (!Number.isFinite(exp) || exp < 3) return false;
  return ["A", "B"].includes(icm) && ["A", "B"].includes(te);
}

export function fertilizationRate(
  cohort: Pick<EmbryoCohort, "day1_2pnCount" | "miiCount">,
): number | null {
  const mii = cohort.miiCount ?? 0;
  const two = cohort.day1_2pnCount ?? 0;
  if (mii <= 0) return null;
  return (two / mii) * 100;
}

export function cleavageRate(
  cohort: Pick<EmbryoCohort, "day3CleavedCount" | "day1_2pnCount">,
): number | null {
  const two = cohort.day1_2pnCount ?? 0;
  const d3 = cohort.day3CleavedCount ?? 0;
  if (two <= 0) return null;
  return (d3 / two) * 100;
}

export function blastRate(
  cohort: Pick<EmbryoCohort, "day5BlastCount" | "day1_2pnCount">,
): number | null {
  const two = cohort.day1_2pnCount ?? 0;
  const d5 = cohort.day5BlastCount ?? 0;
  if (two <= 0) return null;
  return (d5 / two) * 100;
}

export function goodBlastRate(
  cohort: Pick<EmbryoCohort, "day1_2pnCount">,
  embryos: Pick<Embryo, "day5Gardner">[],
): number | null {
  const two = cohort.day1_2pnCount ?? 0;
  if (two <= 0) return null;
  const good = embryos.filter((e) => isGoodBlast(e.day5Gardner)).length;
  return (good / two) * 100;
}

export type KpiSnapshot = {
  fertRate: number | null;
  cleavageRate: number | null;
  blastRate: number | null;
  goodBlastRate: number | null;
  thresholds: ViennaThresholds;
  below: string[];
};

export function cohortKpis(
  cohort: EmbryoCohort,
  embryos: Embryo[],
  thresholds: ViennaThresholds = DEFAULT_VIENNA_THRESHOLDS,
): KpiSnapshot {
  const fert = fertilizationRate(cohort);
  const cleav = cleavageRate(cohort);
  const blast = blastRate(cohort);
  const good = goodBlastRate(cohort, embryos);
  const below: string[] = [];
  if (fert != null && fert < thresholds.fertRate) below.push("fertRate");
  if (cleav != null && cleav < thresholds.cleavageRate) below.push("cleavageRate");
  if (blast != null && blast < thresholds.blastRate) below.push("blastRate");
  if (good != null && good < thresholds.goodBlastRate) below.push("goodBlastRate");
  return {
    fertRate: fert,
    cleavageRate: cleav,
    blastRate: blast,
    goodBlastRate: good,
    thresholds,
    below,
  };
}

export function parseClinicThresholds(
  config: unknown,
): ViennaThresholds {
  const base = { ...DEFAULT_VIENNA_THRESHOLDS };
  if (!config || typeof config !== "object") return base;
  const vienna = (config as { viennaThresholds?: Record<string, number> })
    .viennaThresholds;
  if (!vienna) return base;
  return {
    fertRate: vienna.fertRate ?? base.fertRate,
    cleavageRate: vienna.cleavageRate ?? base.cleavageRate,
    blastRate: vienna.blastRate ?? base.blastRate,
    goodBlastRate: vienna.goodBlastRate ?? base.goodBlastRate,
    vitrificationSurvival:
      vienna.vitrificationSurvival ?? base.vitrificationSurvival,
    implantationRate: vienna.implantationRate ?? base.implantationRate,
  };
}

/**
 * Live births / embryos transferred for a clinic in a time window.
 */
export async function implantationRate(
  clinicId: string,
  timeWindow: { from: Date; to: Date },
): Promise<number | null> {
  const { prisma } = await import("@/lib/db");
  const { CycleEventType, CycleOutcome } = await import("@prisma/client");

  const [transfers, liveBirths] = await Promise.all([
    prisma.cycleEvent.findMany({
      where: {
        clinicId,
        eventType: CycleEventType.TRANSFER,
        occurredAt: { gte: timeWindow.from, lte: timeWindow.to },
      },
      select: { payload: true },
    }),
    prisma.embryoCohort.count({
      where: {
        clinicId,
        outcome: CycleOutcome.PREGNANT,
        outcomeReportedAt: { gte: timeWindow.from, lte: timeWindow.to },
      },
    }),
  ]);

  let embryosTransferred = 0;
  for (const t of transfers) {
    const p = t.payload as { embryoIds?: string[] } | null;
    embryosTransferred += p?.embryoIds?.length ?? 0;
  }

  if (embryosTransferred <= 0) return null;
  return (liveBirths / embryosTransferred) * 100;
}

export function implantationRateFromCounts(
  liveBirths: number,
  embryosTransferred: number,
): number | null {
  if (embryosTransferred <= 0) return null;
  return (liveBirths / embryosTransferred) * 100;
}
