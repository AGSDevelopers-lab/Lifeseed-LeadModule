import { notFound, redirect } from "next/navigation";
import { DonorStatus } from "@prisma/client";

import { UndeferForm } from "./undefer-form";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type Params = Promise<{ id: string }>;

export default async function UndeferDonorPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "donor.undefer")) {
    redirect("/admin/donors");
  }

  const { id } = await params;
  const donor = await prisma.donor.findUnique({ where: { id } });
  if (!donor) notFound();
  if (donor.status !== DonorStatus.DEFERRED) {
    redirect(`/admin/donors/${donor.id}`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">
        Un-defer · {donor.donorCode}
      </h1>
      <UndeferForm donorId={donor.id} donorCode={donor.donorCode} />
    </div>
  );
}
