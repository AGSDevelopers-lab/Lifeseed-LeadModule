import { notFound, redirect } from "next/navigation";

import { ScreeningForm } from "./screening-form";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type Params = Promise<{ id: string }>;

export default async function DonorScreeningPage({
  params,
}: {
  params: Params;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(
      permissionsForRoles(session.roles),
      "donor.screening.enter",
    )
  ) {
    redirect("/admin/donors");
  }

  const { id } = await params;
  const donor = await prisma.donor.findUnique({ where: { id } });
  if (!donor) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">
        Screening · {donor.donorCode}
      </h1>
      <ScreeningForm donorId={donor.id} />
    </div>
  );
}
