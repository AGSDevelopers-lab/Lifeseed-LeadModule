import { notFound, redirect } from "next/navigation";

import { AnalyzeForm } from "./analyze-form";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type Params = Promise<{ id: string }>;

export default async function AnalyzePage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(permissionsForRoles(session.roles), "sample.analyze")
  ) {
    redirect("/admin/samples");
  }
  const { id } = await params;
  const sample = await prisma.sample.findUnique({ where: { id } });
  if (!sample) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">
        Analyze · {sample.sampleCode}
      </h1>
      <AnalyzeForm sampleId={sample.id} />
    </div>
  );
}
