import { notFound, redirect } from "next/navigation";

import { AllocateForm } from "./allocate-form";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type Params = Promise<{ id: string }>;

export default async function AllocatePage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(permissionsForRoles(session.roles), "drf.allocate")
  ) {
    redirect("/admin/drfs");
  }

  const { id } = await params;
  const drf = await prisma.dRF.findUnique({ where: { id } });
  if (!drf) notFound();
  if (drf.state !== "ACCEPTED") {
    redirect(`/admin/drfs/${id}`);
  }

  const vials = await prisma.vial.findMany({
    where: {
      isReleased: true,
      isDispensed: false,
      isDiscarded: false,
      isQuarantined: false,
      sample: {
        siteId: drf.siteId,
        ...(drf.filterCategory ? { category: drf.filterCategory } : {}),
        ...(drf.filterGrade ? { grade: drf.filterGrade } : {}),
      },
      ...(drf.filterCategory ? { category: drf.filterCategory } : {}),
      ...(drf.filterGrade ? { grade: drf.filterGrade } : {}),
    },
    include: {
      tank: true,
      sample: { include: { donor: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  const witnesses = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { not: session.userId },
      roles: {
        some: {
          role: {
            in: [
              "BANK_WITNESS",
              "BANK_CRYOBANK_TECH",
              "BANK_LAB_HEAD",
              "BANK_DISPATCH_COORD",
              "BANK_LOGISTICS",
              "BANK_SUPER_ADMIN",
            ],
          },
        },
      },
    },
    select: { id: true, email: true },
    take: 50,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">
        Allocate · {drf.drfNumber}
      </h1>
      <AllocateForm
        drfId={drf.id}
        requestedQuantity={drf.requestedQuantity}
        priority={drf.priority}
        vials={vials.map((v) => ({
          id: v.id,
          vialCode: v.vialCode,
          category: v.category ?? v.sample.category,
          grade: v.grade ?? v.sample.grade,
          tankCode: v.tank.tankCode,
          donorCode: v.sample.donor.donorCode,
          samplePriority: v.sample.priority,
        }))}
        witnesses={witnesses}
      />
    </div>
  );
}
