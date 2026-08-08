import { prisma } from "@/lib/db";

/** Create empty EmbryoCohort shell for a DRF if missing (Delivered / In-Cycle). */
export async function ensureEmbryoCohort(drfId: string): Promise<string> {
  const existing = await prisma.embryoCohort.findUnique({
    where: { drfId },
  });
  if (existing) return existing.id;

  const drf = await prisma.dRF.findUniqueOrThrow({ where: { id: drfId } });
  const cohort = await prisma.embryoCohort.create({
    data: {
      drfId,
      clinicId: drf.clinicId,
      startedAt: new Date(),
      currentPhase: "E0",
    },
  });
  return cohort.id;
}
