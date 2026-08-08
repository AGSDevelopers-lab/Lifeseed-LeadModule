import { notFound, redirect } from "next/navigation";
import { UserRole } from "@prisma/client";

import { CohortTable } from "@/app/(portals)/clinic/cohorts/[drfId]/cohort-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type PageProps = { params: Promise<{ drfId: string }> };

export default async function CohortDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "cohort.view")) {
    redirect("/clinic");
  }

  const { drfId } = await params;
  const cohort = await prisma.embryoCohort.findUnique({
    where: { drfId },
    include: {
      embryos: { orderBy: { oocyteId: "asc" } },
      drf: { select: { drfNumber: true, clinicId: true } },
    },
  });
  if (!cohort) notFound();
  if (session.clinicId && session.clinicId !== cohort.clinicId) {
    redirect("/clinic/cohorts");
  }

  const canEdit = permissionGranted(
    permissionsForRoles(session.roles),
    "cohort.edit_disposition",
  );

  const witnesses = await prisma.user.findMany({
    where: {
      clinicId: cohort.clinicId,
      isActive: true,
      id: { not: session.userId },
      roles: {
        some: {
          role: {
            in: [
              UserRole.CLINIC_WITNESS,
              UserRole.CLINIC_EMBRYOLOGIST,
              UserRole.CLINIC_DOCTOR,
            ],
          },
        },
      },
    },
    select: { id: true, email: true },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">
          Cohort · {cohort.drf.drfNumber}
        </h1>
        <p className="text-sm text-stone-600">
          Phase {cohort.currentPhase} · per-embryo dispositions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-stone-700">
            Oocytes {cohort.oocytesRetrieved ?? 0} → MII {cohort.miiCount ?? 0} →
            2PN {cohort.day1_2pnCount ?? 0} → Day5 {cohort.day5BlastCount ?? 0} →
            Transfer {cohort.transferredCount ?? 0} / Vitrify{" "}
            {cohort.vitrifiedCount ?? 0} / Discard {cohort.discardedCount ?? 0}
          </p>
        </CardContent>
      </Card>

      <CohortTable
        drfId={drfId}
        embryos={cohort.embryos.map((e) => ({
          id: e.id,
          oocyteId: e.oocyteId,
          oocyteMaturity: e.oocyteMaturity,
          day1_2pn: e.day1_2pn,
          day3Grade: e.day3Grade,
          day5Gardner: e.day5Gardner,
          pgtResult: e.pgtResult,
          disposition: e.disposition,
          storageRef: e.storageRef,
        }))}
        canEdit={canEdit}
        witnesses={witnesses}
      />
    </div>
  );
}
