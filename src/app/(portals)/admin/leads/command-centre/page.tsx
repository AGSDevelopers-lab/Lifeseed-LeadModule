import Link from "next/link";
import { redirect } from "next/navigation";
import { FollowUpStatus, LeadStatus } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { countScopedLeads } from "@/lib/leads/adapters/prisma-lead-repository";
import { groupLeadsBySource } from "@/lib/leads/adapters/prisma-lead-analytics";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { FUNNEL_CONTACTED_STATUSES } from "@/lib/leads/application/funnel-status-groups";
import { canViewLeadAnalytics } from "@/lib/leads/application/lead-analytics-access";
import {
  createPrismaAssignmentDirectory,
  loadAssignmentRules,
} from "@/lib/leads/adapters/prisma-assignment-directory";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/rbac";

const CLOSED = [
  LeadStatus.CONVERTED,
  LeadStatus.LOST,
  LeadStatus.EXPIRED_AUTO_PURGED,
  LeadStatus.DO_NOT_CALL,
];

export default async function LeadCommandCentrePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canViewLeadAnalytics(session)) redirect("/admin/leads");

  const actor = await resolveLeadActor();
  if (!actor) redirect("/login");

  const atRiskBefore = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const [
    active,
    newLeads,
    qualified,
    converted,
    lost,
    openFollowUps,
    bySource,
    breached,
    atRisk,
  ] = await Promise.all([
    countScopedLeads(actor, { statusNotIn: CLOSED }),
    countScopedLeads(actor, { status: LeadStatus.NEW }),
    countScopedLeads(actor, { statuses: FUNNEL_CONTACTED_STATUSES }),
    countScopedLeads(actor, { status: LeadStatus.CONVERTED }),
    countScopedLeads(actor, { status: LeadStatus.LOST }),
    prisma.leadFollowUp.count({
      where: { status: { notIn: [FollowUpStatus.COMPLETED, FollowUpStatus.CANCELLED] } },
    }),
    groupLeadsBySource(actor),
    prisma.slaSchedule.count({
      where: { status: "BREACHED", entityType: "LEAD_RESPONSE" },
    }),
    countScopedLeads(actor, {
      slaResponseDueBefore: atRiskBefore,
      statusNotIn: CLOSED,
    }),
  ]);

  const rules = await loadAssignmentRules();
  const directory = await createPrismaAssignmentDirectory();
  const items = await directory.listAvailableTelecallers();
  const bySite = new Map<
    string,
    { siteId: string | null; telecallers: number; openLeads: number; atCapacity: number }
  >();
  for (const row of items) {
    const key = row.siteId ?? "unscoped";
    const cur = bySite.get(key) ?? {
      siteId: row.siteId,
      telecallers: 0,
      openLeads: 0,
      atCapacity: 0,
    };
    cur.telecallers += 1;
    cur.openLeads += row.openLeadCount;
    if (row.openLeadCount >= rules.maxQueuePerTelecaller) cur.atCapacity += 1;
    bySite.set(key, cur);
  }

  const kpis = [
    ["Total active leads", active],
    ["New leads", newLeads],
    ["Qualified leads", qualified],
    ["Converted leads", converted],
    ["Lost leads", lost],
    ["Open follow-ups", openFollowUps],
    ["Current SLA breaches", breached],
    ["Current at-risk leads", atRisk],
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Lead command centre</h1>
        <p className="text-sm text-stone-600">
          Refresh-on-load snapshot.{" "}
          <Link href="/admin/leads" className="text-emerald-900 hover:underline">
            Back to leads
          </Link>
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-sm text-stone-500">{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{value}</CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Source funnel</h2>
        <div className="rounded-xl border border-stone-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Leads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bySource.map((r) => (
                <TableRow key={r.source}>
                  <TableCell>{r.source}</TableCell>
                  <TableCell>{r._count._all}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Telecaller workload</h2>
        <p className="mb-2 text-xs text-stone-500">
          Same shape as GET /api/leads/v2/assignment/workload (max queue {rules.maxQueuePerTelecaller}).
        </p>
        <div className="rounded-xl border border-stone-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site</TableHead>
                <TableHead>Telecallers</TableHead>
                <TableHead>Open leads</TableHead>
                <TableHead>At capacity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...bySite.values()].map((r) => (
                <TableRow key={r.siteId ?? "unscoped"}>
                  <TableCell>{r.siteId ?? "unscoped"}</TableCell>
                  <TableCell>{r.telecallers}</TableCell>
                  <TableCell>{r.openLeads}</TableCell>
                  <TableCell>{r.atCapacity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
