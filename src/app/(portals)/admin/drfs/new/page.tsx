import { redirect } from "next/navigation";

import { DrfCreateForm } from "./drf-create-form";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export default async function NewDrfPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "drf.create")) {
    redirect("/admin/drfs");
  }

  const [clinics, sites] = await Promise.all([
    prisma.clinic.findMany({
      include: { contract: true },
      orderBy: { clinicCode: "asc" },
    }),
    prisma.site.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">New DRF</h1>
      <DrfCreateForm
        clinics={clinics.map((c) => ({
          id: c.id,
          clinicCode: c.clinicCode,
          name: c.name,
          siteId: c.siteId,
          hasContract: Boolean(c.contract?.isActive),
        }))}
        sites={sites.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
        }))}
      />
    </div>
  );
}
