import { notFound, redirect } from "next/navigation";

import { PostThawForm } from "./post-thaw-form";
import { prisma } from "@/lib/db";
import { listQcGateConfigs, POST_THAW_PARAM_GATES } from "@/lib/qc-config";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type Params = Promise<{ id: string }>;

export default async function PostThawPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(permissionsForRoles(session.roles), "sample.post_thaw")
  ) {
    redirect("/admin/samples");
  }

  const { id } = await params;
  const sample = await prisma.sample.findUnique({ where: { id } });
  if (!sample) notFound();

  const all = await listQcGateConfigs(sample.siteId);
  const gates = all.filter((g) =>
    POST_THAW_PARAM_GATES.includes(g.gateName),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">
        Post-thaw · {sample.sampleCode}
      </h1>
      <PostThawForm sampleId={sample.id} gates={gates} />
    </div>
  );
}
