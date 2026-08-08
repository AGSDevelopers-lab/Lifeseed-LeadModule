"use server";

import { EmbryoDisposition } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import { logAttestation } from "@/lib/witness";

const dispositionSchema = z.object({
  embryoIds: z.array(z.string()).min(1),
  disposition: z.nativeEnum(EmbryoDisposition),
  witnessUserId: z.string().optional(),
  storageRef: z.string().optional(),
  drfId: z.string().min(1),
});

export async function updateEmbryoDispositions(input: unknown): Promise<{
  ok: boolean;
  error?: string;
}> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  if (
    !permissionGranted(
      permissionsForRoles(session.roles),
      "cohort.edit_disposition",
    )
  ) {
    return { ok: false, error: "Forbidden" };
  }

  const parsed = dispositionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const d = parsed.data;

  const needsWitness =
    d.disposition === EmbryoDisposition.VITRIFIED ||
    d.disposition === EmbryoDisposition.DISCARDED_ABNORMAL ||
    d.disposition === EmbryoDisposition.DISCARDED_ARREST;

  if (needsWitness && !d.witnessUserId) {
    return { ok: false, error: "2-witness required for this disposition" };
  }

  const cohort = await prisma.embryoCohort.findUnique({
    where: { drfId: d.drfId },
  });
  if (!cohort) return { ok: false, error: "Cohort not found" };
  if (session.clinicId && session.clinicId !== cohort.clinicId) {
    return { ok: false, error: "Forbidden" };
  }

  if (needsWitness && d.witnessUserId) {
    await logAttestation({
      action: `cohort_disposition_${d.disposition.toLowerCase()}`,
      entityType: "EmbryoCohort",
      entityId: cohort.id,
      primaryUserId: session.userId,
      witnessUserId: d.witnessUserId,
    });
  }

  await prisma.embryo.updateMany({
    where: { id: { in: d.embryoIds }, cohortId: cohort.id },
    data: {
      disposition: d.disposition,
      ...(d.storageRef ? { storageRef: d.storageRef } : {}),
      ...(d.disposition === EmbryoDisposition.TRANSFERRED
        ? { transferredAt: new Date() }
        : {}),
    },
  });

  const [vitrifiedCount, discardedCount, transferredCount] = await Promise.all([
    prisma.embryo.count({
      where: { cohortId: cohort.id, disposition: EmbryoDisposition.VITRIFIED },
    }),
    prisma.embryo.count({
      where: {
        cohortId: cohort.id,
        disposition: {
          in: [
            EmbryoDisposition.DISCARDED_ABNORMAL,
            EmbryoDisposition.DISCARDED_ARREST,
          ],
        },
      },
    }),
    prisma.embryo.count({
      where: {
        cohortId: cohort.id,
        disposition: EmbryoDisposition.TRANSFERRED,
      },
    }),
  ]);

  await prisma.embryoCohort.update({
    where: { id: cohort.id },
    data: { vitrifiedCount, discardedCount, transferredCount },
  });

  await audit.log({
    actorUserId: session.userId,
    action: "UPDATE",
    entityType: "EmbryoCohort",
    entityId: cohort.id,
    afterJson: {
      embryoIds: d.embryoIds,
      disposition: d.disposition,
    },
  });

  revalidatePath(`/clinic/cohorts/${d.drfId}`);
  revalidatePath(`/clinic/cycles/${d.drfId}`);
  return { ok: true };
}
