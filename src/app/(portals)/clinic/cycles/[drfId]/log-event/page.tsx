import { notFound, redirect } from "next/navigation";
import { UserRole } from "@prisma/client";

import { LogEventForm } from "@/app/(portals)/clinic/cycles/[drfId]/log-event/log-event-form";
import { eventsForPhase } from "@/lib/embryology/cycle-events";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type PageProps = { params: Promise<{ drfId: string }> };

export default async function LogCycleEventPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(permissionsForRoles(session.roles), "cycle.log_event")
  ) {
    redirect("/clinic/cycles");
  }

  const { drfId } = await params;
  const drf = await prisma.dRF.findUnique({
    where: { id: drfId },
    include: { cohort: true },
  });
  if (!drf) notFound();
  if (session.clinicId && session.clinicId !== drf.clinicId) {
    redirect("/clinic/cycles");
  }

  const phase = drf.cohort?.currentPhase ?? "E0";
  const allowed = eventsForPhase(phase);

  const witnesses = await prisma.user.findMany({
    where: {
      clinicId: drf.clinicId,
      isActive: true,
      id: { not: session.userId },
      roles: {
        some: {
          role: {
            in: [
              UserRole.CLINIC_WITNESS,
              UserRole.CLINIC_EMBRYOLOGIST,
              UserRole.CLINIC_DOCTOR,
              UserRole.L2_EMBRYOLOGIST,
              UserRole.L2_SR_EMBRYOLOGIST,
            ],
          },
        },
      },
    },
    select: { id: true, email: true },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Log cycle event</h1>
        <p className="text-sm text-stone-600">
          {drf.drfNumber} · current phase {phase} · location defaults to L2
        </p>
      </div>
      <LogEventForm
        drfId={drfId}
        allowedEvents={allowed}
        witnesses={witnesses}
      />
    </div>
  );
}
