import { redirect } from "next/navigation";
import { LeadStatus } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { countLeadsWhere, groupLeadsBySource } from "@/lib/leads/adapters/prisma-lead-analytics";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export default async function AdminLeadsAnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(
      permissionsForRoles(session.roles),
      "marketing.analytics",
    ) &&
    !permissionGranted(permissionsForRoles(session.roles), "lead.list")
  ) {
    redirect("/admin/leads");
  }

  const actor = await resolveLeadActor();
  if (!actor) redirect("/login");

  const bySource = await groupLeadsBySource(actor);
  const convertedBySource = await groupLeadsBySource(actor, {
    status: LeadStatus.CONVERTED,
  });
  const convMap = new Map(
    convertedBySource.map((r) => [r.source, r._count._all]),
  );

  const telecallers = await prisma.user.findMany({
    where: { roles: { some: { role: "TELECALLER" } } },
    select: { id: true, email: true },
    take: 30,
  });
  const leaderboard = await Promise.all(
    telecallers.map(async (t) => {
      const [calls, conversions] = await Promise.all([
        prisma.callDisposition.count({ where: { telecallerId: t.id } }),
        countLeadsWhere(actor, {
            convertedByUserId: t.id,
            status: LeadStatus.CONVERTED,
          }),
      ]);
      return { email: t.email, calls, conversions };
    }),
  );
  leaderboard.sort((a, b) => b.conversions - a.conversions);

  const breached = await prisma.slaSchedule.count({
    where: { status: "BREACHED", entityType: "LEAD_RESPONSE" },
  });
  const leadSlas = await prisma.slaSchedule.count({
    where: { entityType: "LEAD_RESPONSE" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Lead analytics</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-stone-500">
              SLA breach rate (lead response)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {leadSlas === 0
              ? "—"
              : `${Math.round((breached / leadSlas) * 100)}%`}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-stone-500">
              CAC placeholders
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-stone-600">
            CAC per active donor / registered recipient requires marketing spend
            input (not wired in v1).
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Conversion by source</h2>
        <div className="rounded-xl border border-stone-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Converted</TableHead>
                <TableHead>Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bySource.map((r) => {
                const conv = convMap.get(r.source) ?? 0;
                const rate =
                  r._count._all === 0
                    ? 0
                    : Math.round((conv / r._count._all) * 100);
                return (
                  <TableRow key={r.source}>
                    <TableCell>{r.source}</TableCell>
                    <TableCell>{r._count._all}</TableCell>
                    <TableCell>{conv}</TableCell>
                    <TableCell>{rate}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Telecaller leaderboard</h2>
        <div className="rounded-xl border border-stone-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Telecaller</TableHead>
                <TableHead>Calls</TableHead>
                <TableHead>Conversions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map((r) => (
                <TableRow key={r.email}>
                  <TableCell>{r.email}</TableCell>
                  <TableCell>{r.calls}</TableCell>
                  <TableCell>{r.conversions}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
