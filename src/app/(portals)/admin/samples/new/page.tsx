import { redirect } from "next/navigation";

import { AccessionForm } from "./accession-form";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export default async function NewSamplePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(permissionsForRoles(session.roles), "sample.accession")
  ) {
    redirect("/admin/samples");
  }

  const donors = await prisma.donor.findMany({
    where: { status: { in: ["ACTIVE", "ELIGIBLE"] } },
    select: {
      id: true,
      donorCode: true,
      fullName: true,
      siteId: true,
      type: true,
    },
    orderBy: { donorCode: "asc" },
    take: 500,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">
        Accession sample
      </h1>
      <AccessionForm donors={donors} />
    </div>
  );
}
