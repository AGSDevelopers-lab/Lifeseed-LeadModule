import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type Params = Promise<{ id: string }>;

export default async function AdminLeadDetailPage({
  params,
}: {
  params: Params;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "lead.view")) {
    redirect("/admin/leads");
  }
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedTelecaller: { select: { email: true } },
      callDispositions: { orderBy: { createdAt: "desc" }, take: 10 },
      counsellingBooking: true,
    },
  });
  if (!lead) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/leads" className="text-sm text-emerald-900 hover:underline">
          ← Leads
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{lead.leadCode}</h1>
        <p className="text-sm text-stone-600">
          {lead.fullName} · {lead.tier} · {lead.status} · score {lead.score}
        </p>
        <p className="text-xs text-stone-500">
          Telecaller: {lead.assignedTelecaller?.email ?? "unassigned"} ·{" "}
          <Link
            href={`/telecaller/leads/${lead.id}`}
            className="text-emerald-900 hover:underline"
          >
            Open telecaller view
          </Link>
        </p>
      </div>
      <pre className="overflow-auto rounded-xl border border-stone-200 bg-white p-4 text-xs">
        {JSON.stringify(
          {
            source: lead.source,
            scoreBreakdown: lead.scoreBreakdown,
            consent: {
              marketing: lead.consentMarketing,
              screening: lead.consentScreening,
              processing: lead.consentDataProcessing,
              version: lead.consentVersion,
            },
            convertedDonorId: lead.convertedDonorId,
            convertedRecipientId: lead.convertedRecipientId,
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
}
