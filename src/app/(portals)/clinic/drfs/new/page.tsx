import { redirect } from "next/navigation";

import { DrfCreateForm } from "@/app/(portals)/admin/drfs/new/drf-create-form";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export default async function ClinicNewDrfPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "drf.create")) {
    redirect("/clinic/drfs");
  }
  if (!session.clinicId) redirect("/clinic/drfs");

  const clinic = await prisma.clinic.findUnique({
    where: { id: session.clinicId },
    include: { contract: true },
  });
  if (!clinic) redirect("/clinic/drfs");

  const sites = await prisma.site.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">New DRF</h1>
      <DrfCreateForm
        lockedClinicId={clinic.id}
        clinics={[
          {
            id: clinic.id,
            clinicCode: clinic.clinicCode,
            name: clinic.name,
            siteId: clinic.siteId,
            hasContract: Boolean(clinic.contract?.isActive),
          },
        ]}
        sites={sites.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
        }))}
      />
    </div>
  );
}
