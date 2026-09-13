import Link from "next/link";
import { redirect } from "next/navigation";
import { LeadStatus } from "@prisma/client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  countScopedLeads,
  prismaLeadRepository,
} from "@/lib/leads/adapters/prisma-lead-repository";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import {
  FUNNEL_CONTACTED_STATUSES,
  FUNNEL_COUNSELLED_STATUSES,
} from "@/lib/leads/application/funnel-status-groups";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tier?: string;
    status?: string;
    source?: string;
    personType?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "lead.list")) {
    redirect("/admin");
  }
  const sp = await searchParams;
  const actor = await resolveLeadActor();
  if (!actor) redirect("/login");

  const page = await prismaLeadRepository.list(actor, {
    tier: sp.tier,
    status: sp.status,
    source: sp.source,
    personType: sp.personType,
    limit: 200,
  });
  const rows = page.items;

  const [newCount, contacted, counselled, converted] = await Promise.all([
    countScopedLeads(actor, { status: LeadStatus.NEW }),
    countScopedLeads(actor, { statuses: FUNNEL_CONTACTED_STATUSES }),
    countScopedLeads(actor, { statuses: FUNNEL_COUNSELLED_STATUSES }),
    countScopedLeads(actor, { status: LeadStatus.CONVERTED }),
  ]);

  const canExport = permissionGranted(
    permissionsForRoles(session.roles),
    "lead.export",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-stone-600">
            Funnel: {newCount} lead → {contacted} contacted → {counselled}{" "}
            counselled → {converted} converted
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/leads/analytics" className="text-emerald-900 hover:underline">
            Analytics
          </Link>
          <Link href="/admin/leads/crm" className="text-emerald-900 hover:underline">
            CRM sync
          </Link>
          <Link href="/admin/leads/do-not-call" className="text-emerald-900 hover:underline">
            Do Not Call
          </Link>
          <Link href="/admin/leads/config" className="text-emerald-900 hover:underline">
            Config
          </Link>
          <Link href="/admin/leads/notifications/templates" className="text-emerald-900 hover:underline">
            Templates
          </Link>
          <Link href="/admin/leads/notifications/delivery-log" className="text-emerald-900 hover:underline">
            Delivery log
          </Link>
          {canExport && (
            <a
              href="/api/leads/export"
              className="text-emerald-900 hover:underline"
            >
              Export CSV
            </a>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Telecaller</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link
                    href={`/admin/leads/${r.id}`}
                    className="font-medium text-emerald-900 hover:underline"
                  >
                    {r.code.toString()}
                  </Link>
                </TableCell>
                <TableCell>{r.props.contact.fullName ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.props.personType}</TableCell>
                <TableCell className="text-xs">{r.props.source}</TableCell>
                <TableCell>{r.props.latestScore?.tier ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.status}</TableCell>
                <TableCell className="text-xs">
                  {r.props.ownership.assignedTelecallerId ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
