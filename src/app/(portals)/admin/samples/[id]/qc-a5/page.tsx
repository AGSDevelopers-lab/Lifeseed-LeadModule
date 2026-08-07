import { notFound, redirect } from "next/navigation";

import { QcA5Form } from "./qc-a5-form";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type Params = Promise<{ id: string }>;

export default async function QcA5Page({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "sample.qc")) {
    redirect("/admin/samples");
  }

  const { id } = await params;
  const sample = await prisma.sample.findUnique({ where: { id } });
  if (!sample) notFound();

  const witnesses = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { not: session.userId },
      roles: {
        some: {
          role: {
            in: [
              "BANK_WITNESS",
              "BANK_SR_ANDROLOGIST",
              "BANK_LAB_HEAD",
              "BANK_ANDROLOGY_TECH",
              "BANK_CRYOBANK_TECH",
              "BANK_QC_OFFICER",
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
        QC-A5 · {sample.sampleCode}
      </h1>
      <QcA5Form
        sampleId={sample.id}
        sampleCode={sample.sampleCode}
        preFreezePR={sample.progressiveMotilityPct}
        witnesses={witnesses}
      />
    </div>
  );
}
