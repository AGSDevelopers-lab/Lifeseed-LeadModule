import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LeadStatus } from "@prisma/client";

import { LeadCallPanel } from "@/app/(portals)/telecaller/leads/[id]/lead-call-panel";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type Params = Promise<{ id: string }>;

export default async function TelecallerLeadDetailPage({
  params,
}: {
  params: Params;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "lead.view")) {
    redirect("/telecaller/queue");
  }

  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      callDispositions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      counsellingBooking: true,
    },
  });
  if (!lead) notFound();

  const canConvert =
    permissionGranted(permissionsForRoles(session.roles), "lead.convert") &&
    (lead.status === LeadStatus.CONTACTED_QUALIFIED ||
      lead.status === LeadStatus.COUNSELLING_ATTENDED);

  const sites = await prisma.site.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
  });
  const clinics = await prisma.clinic.findMany({
    select: { id: true, name: true, clinicCode: true },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-stone-500">{lead.leadCode}</p>
          <h1 className="text-2xl font-semibold">{lead.fullName ?? "Lead"}</h1>
          <p className="text-sm text-stone-600">
            {lead.tier} · {lead.status} · {lead.source} · {lead.city ?? "—"}
          </p>
          {lead.slaResponseDueAt && (
            <p className="mt-1 text-xs text-amber-800">
              SLA response due{" "}
              {lead.slaResponseDueAt.toISOString().replace("T", " ").slice(0, 16)}{" "}
              UTC
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {lead.phone && (
            <a href={`tel:${lead.phoneCountryCode}${lead.phone}`}>
              <Button>Click to call</Button>
            </a>
          )}
          {lead.personType === "RECIPIENT" && canConvert && (
            <Link href={`/telecaller/leads/${lead.id}/book-counselling`}>
              <Button variant="outline">Book counselling</Button>
            </Link>
          )}
        </div>
      </div>

      <LeadCallPanel
        leadId={lead.id}
        personType={lead.personType}
        canConvert={canConvert}
        sites={sites}
        clinics={clinics}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Call history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {lead.callDispositions.length === 0 && (
            <p className="text-stone-500">No calls yet</p>
          )}
          {lead.callDispositions.map((c) => (
            <div key={c.id} className="rounded-md bg-stone-50 px-3 py-2">
              <div className="font-medium">{c.disposition}</div>
              <div className="text-xs text-stone-500">
                {c.callStartedAt.toISOString().slice(0, 16)} ·{" "}
                {c.durationSeconds ?? 0}s
              </div>
              {c.notes && <p className="mt-1 text-xs">{c.notes}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
