import { notFound, redirect } from "next/navigation";

import { DeferRejectForm } from "../defer/defer-reject-form";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type Params = Promise<{ id: string }>;

export default async function DeferDonorPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "donor.defer")) {
    redirect("/admin/donors");
  }

  const { id } = await params;
  const donor = await prisma.donor.findUnique({ where: { id } });
  if (!donor) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">
        Defer · {donor.donorCode}
      </h1>
      <DeferRejectForm mode="defer" donorId={donor.id} />
    </div>
  );
}
