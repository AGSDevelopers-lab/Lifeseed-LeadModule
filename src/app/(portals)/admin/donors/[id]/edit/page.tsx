import { notFound, redirect } from "next/navigation";

import { EditDonorForm } from "./edit-form";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type Params = Promise<{ id: string }>;

export default async function EditDonorPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "donor.edit")) {
    redirect("/admin/donors");
  }

  const { id } = await params;
  const donor = await prisma.donor.findUnique({ where: { id } });
  if (!donor) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">
        Edit · {donor.donorCode}
      </h1>
      <EditDonorForm
        donorId={donor.id}
        donorCode={donor.donorCode}
        defaults={{
          phone: donor.phone,
          email: donor.email,
          addressLine: donor.addressLine,
          city: donor.city,
          stateCode: donor.stateCode,
          pincode: donor.pincode,
          maritalStatus: donor.maritalStatus,
          hasLivingChild: donor.hasLivingChild,
          height: donor.height,
          weight: donor.weight,
          panMasked: donor.panMasked,
          aadhaarHash: donor.aadhaarHash,
        }}
      />
    </div>
  );
}
