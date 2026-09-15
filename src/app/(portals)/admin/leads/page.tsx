import Link from "next/link";
import { redirect } from "next/navigation";
import { LeadStatus } from "@prisma/client";
import { Eye } from "lucide-react";

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

const AT_RISK_MS = 2 * 60 * 60 * 1000;

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tier?: string;
    status?: string;
    source?: string;
    personType?: string;
    sort?: string;
    sla?: string;
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

  const slaUrgency = sp.sort === "sla";
  const slaAtRisk = sp.sla === "at-risk";
  const slaBreached = sp.sla === "breached";

  const page = await prismaLeadRepository.list(actor, {
    tier: sp.tier,
    status: sp.status,
    source: sp.source,
    personType: sp.personType,
    limit: 200,
    orderBy: slaUrgency ? "slaResponseDueAt" : "capturedAt",
    slaResponseDueBefore: slaAtRisk ? new Date(Date.now() + AT_RISK_MS) : undefined,
    slaBreached: slaBreached || undefined,
    statusNotIn: slaAtRisk
      ? [
          LeadStatus.CONVERTED,
          LeadStatus.LOST,
          LeadStatus.EXPIRED_AUTO_PURGED,
          LeadStatus.DO_NOT_CALL,
        ]
      : undefined,
  });
  const rows = page.items;

  const [newCount, contacted, counselled, converted] = await Promise.all([
    countScopedLeads(actor, { status: LeadStatus.NEW }),
    countScopedLeads(actor, { statuses: FUNNEL_CONTACTED_STATUSES }),
    countScopedLeads(actor, { statuses: FUNNEL_COUNSELLED_STATUSES }),
    countScopedLeads(actor, { status: LeadStatus.CONVERTED }),
  ]);

  const qs = (next: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = {
      tier: sp.tier,
      status: sp.status,
      source: sp.source,
      personType: sp.personType,
      sort: sp.sort,
      sla: sp.sla,
      ...next,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="text-sm text-stone-600">
          Funnel: {newCount} lead → {contacted} contacted → {counselled}{" "}
          counselled → {converted} converted
        </p>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="text-stone-500">SLA:</span>
        <Link
          href={`/admin/leads${qs({ sort: slaUrgency ? undefined : "sla" })}`}
          className={slaUrgency ? "font-medium text-brand-800" : "text-brand-800 hover:underline"}
        >
          {slaUrgency ? "Urgency sort on" : "Sort by SLA urgency"}
        </Link>
        <Link
          href={`/admin/leads${qs({ sla: slaAtRisk ? undefined : "at-risk" })}`}
          className={slaAtRisk ? "font-medium text-amber-800" : "text-brand-800 hover:underline"}
        >
          At-risk (≤2h)
        </Link>
        <Link
          href={`/admin/leads${qs({ sla: slaBreached ? undefined : "breached" })}`}
          className={slaBreached ? "font-medium text-red-800" : "text-brand-800 hover:underline"}
        >
          Breached
        </Link>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-surface-raised shadow-[0_2px_10px_-2px_rgba(180,90,30,0.12)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Telecaller</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link
                    href={`/admin/leads/${r.id}`}
                    className="inline-flex max-w-[12rem] items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap font-medium text-brand-800 hover:underline"
                    title={r.code.toString()}
                  >
                    <Eye className="h-4 w-4 shrink-0" />
                    {r.code.toString()}
                  </Link>
                </TableCell>
                <TableCell
                  className="max-w-[12rem] overflow-hidden text-ellipsis whitespace-nowrap"
                  title={r.props.contact.fullName ?? "—"}
                >
                  {r.props.contact.fullName ?? "—"}
                </TableCell>
                <TableCell className="text-xs">{r.props.personType}</TableCell>
                <TableCell className="text-xs">{r.props.source}</TableCell>
                <TableCell>{r.props.latestScore?.tier ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.status}</TableCell>
                <TableCell className="text-xs">{r.props.outcome ?? "—"}</TableCell>
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
