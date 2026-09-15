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
import { countLeadsWhere, groupLeadsBySource, groupLeadsByTier, groupLeadsByEntryCohort } from "@/lib/leads/adapters/prisma-lead-analytics";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { computeCampaignCac } from "@/lib/leads/application/attribution";
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
  const byTier = await groupLeadsByTier(actor);
  const convertedByTier = await groupLeadsByTier(actor, {
    status: LeadStatus.CONVERTED,
  });
  const cohorts = await groupLeadsByEntryCohort(actor);
  const convMap = new Map(
    convertedBySource.map((r) => [r.source, r._count._all]),
  );
  const convTierMap = new Map(
    convertedByTier.map((r) => [r.tier, r._count._all]),
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

  const canAnalytics = permissionGranted(permissionsForRoles(session.roles), "analytics.view");
  const cacDonor = canAnalytics
    ? await computeCampaignCac({ actor, scope: "donor" })
    : [];
  const cacRecipient = canAnalytics
    ? await computeCampaignCac({ actor, scope: "recipient" })
    : [];
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
              CAC (last-touch, INR)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-stone-600">
            {canAnalytics ? (
              <div className="space-y-3">
                <p className="text-xs text-stone-500">
                  CAC = actualSpendInr / last-touch attributed leads. Zero leads → null.
                </p>
                <div>
                  <p className="font-medium text-stone-800">Donor</p>
                  {cacDonor.length === 0 ? (
                    <p>No campaigns.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {cacDonor.map((r) => (
                        <li key={`d-${r.campaignId}`}>
                          {r.code}: {r.cac == null ? "—" : r.cac.toFixed(2)} INR ({r.leadCount} leads)
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="font-medium text-stone-800">Recipient</p>
                  {cacRecipient.length === 0 ? (
                    <p>No campaigns.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {cacRecipient.map((r) => (
                        <li key={`r-${r.campaignId}`}>
                          {r.code}: {r.cac == null ? "—" : r.cac.toFixed(2)} INR ({r.leadCount} leads)
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <p>Requires analytics.view.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Conversion by source</h2>
        <div className="rounded-2xl border border-stone-200 bg-surface-raised shadow-[0_2px_10px_-2px_rgba(180,90,30,0.12)]">
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
        <h2 className="mb-2 font-semibold">Conversion by tier</h2>
        <div className="rounded-2xl border border-stone-200 bg-surface-raised shadow-[0_2px_10px_-2px_rgba(180,90,30,0.12)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Converted</TableHead>
                <TableHead>Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byTier.map((r) => {
                const conv = convTierMap.get(r.tier) ?? 0;
                const rate =
                  r._count._all === 0
                    ? 0
                    : Math.round((conv / r._count._all) * 100);
                return (
                  <TableRow key={r.tier}>
                    <TableCell>{r.tier}</TableCell>
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
        <h2 className="mb-2 font-semibold">Cohort analysis</h2>
        <p className="mb-2 text-xs text-stone-500">
          Monthly entry cohort by createdAt. Conversion windows 30/60/90 days from entry.
          Windows not yet elapsed show in progress, not 0%.
        </p>
        <div className="rounded-2xl border border-stone-200 bg-surface-raised shadow-[0_2px_10px_-2px_rgba(180,90,30,0.12)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cohort month</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>30-day</TableHead>
                <TableHead>60-day</TableHead>
                <TableHead>90-day</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cohorts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-stone-500">
                    No cohorts
                  </TableCell>
                </TableRow>
              )}
              {cohorts.map((c) => (
                <TableRow key={c.month}>
                  <TableCell>{c.month}</TableCell>
                  <TableCell>{c.cohortSize}</TableCell>
                  <TableCell>
                    {c.d30.status === "in_progress" ? "in progress" : `${c.d30.ratePct}%`}
                  </TableCell>
                  <TableCell>
                    {c.d60.status === "in_progress" ? "in progress" : `${c.d60.ratePct}%`}
                  </TableCell>
                  <TableCell>
                    {c.d90.status === "in_progress" ? "in progress" : `${c.d90.ratePct}%`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Telecaller leaderboard</h2>
        <div className="rounded-2xl border border-stone-200 bg-surface-raised shadow-[0_2px_10px_-2px_rgba(180,90,30,0.12)]">
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
