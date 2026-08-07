import { redirect } from "next/navigation";

import { DonorIntakeForm } from "./intake-form";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export default async function NewDonorPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "donor.create")) {
    redirect("/admin/donors");
  }

  const sites = await prisma.site.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">New donor</h1>
      <DonorIntakeForm sites={sites} />
    </div>
  );
}
