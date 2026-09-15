import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { listAtRiskLeads } from "@/lib/leads/adapters/prisma-lead-repository";
import { canViewLeadAnalytics } from "@/lib/leads/application/lead-analytics-access";
import {
  listLeadSlaBreaches,
  loadSlaBreachTrend,
} from "@/lib/leads/application/sla-monitor";
import { getSession } from "@/lib/rbac";

export default async function LeadSlaMonitorPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canViewLeadAnalytics(session)) redirect("/admin/leads");

  const actor = await resolveLeadActor();
  if (!actor) redirect("/login");

  const dueBefore = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const [breaches, atRisk, trend] = await Promise.all([
    listLeadSlaBreaches(),
    listAtRiskLeads(actor, dueBefore),
    loadSlaBreachTrend(8),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">SLA monitor</h1>
        <p className="text-sm text-stone-600">
          Refresh-on-load.{" "}
          <Link href="/admin/leads" className="inline-flex items-center gap-1 text-brand-800 hover:underline">
            <Eye className="h-4 w-4" />
            Back to leads
          </Link>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-stone-500">Current breaches</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{breaches.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-stone-500">At-risk leads (≤2h)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{atRisk.length}</CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Current breaches</h2>
        <div className="rounded-2xl border border-stone-200 bg-surface-raised shadow-[0_2px_10px_-2px_rgba(180,90,30,0.12)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity type</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Entity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breaches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-stone-500">
                    No breaches
                  </TableCell>
                </TableRow>
              )}
              {breaches.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.entityType}</TableCell>
                  <TableCell className="text-xs">{r.stageKey}</TableCell>
                  <TableCell className="text-xs">
                    {r.responseDueAt.toISOString().slice(0, 16)}
                  </TableCell>
                  <TableCell className="text-xs">{r.status}</TableCell>
                  <TableCell className="text-xs">{r.entityId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">At-risk leads</h2>
        <div className="rounded-2xl border border-stone-200 bg-surface-raised shadow-[0_2px_10px_-2px_rgba(180,90,30,0.12)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>SLA due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {atRisk.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-stone-500">
                    None at risk
                  </TableCell>
                </TableRow>
              )}
              {atRisk.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/admin/leads/${r.id}`}
                      className="inline-flex max-w-[12rem] items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap text-brand-800 hover:underline"
                      title={r.leadCode}
                    >
                      <Eye className="h-4 w-4 shrink-0" />
                      {r.leadCode}
                    </Link>
                  </TableCell>
                  <TableCell
                    className="max-w-[12rem] overflow-hidden text-ellipsis whitespace-nowrap"
                    title={r.fullName ?? "—"}
                  >
                    {r.fullName ?? "—"}
                  </TableCell>
                  <TableCell>{r.tier}</TableCell>
                  <TableCell className="text-xs">{r.status}</TableCell>
                  <TableCell className="text-xs">
                    {r.slaResponseDueAt?.toISOString().slice(0, 16) ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Historical breach rate (8 weeks)</h2>
        <div className="rounded-2xl border border-stone-200 bg-surface-raised shadow-[0_2px_10px_-2px_rgba(180,90,30,0.12)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week start</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Breached</TableHead>
                <TableHead>Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trend.map((r) => (
                <TableRow key={r.weekStart}>
                  <TableCell>{r.weekStart}</TableCell>
                  <TableCell>{r.total}</TableCell>
                  <TableCell>{r.breached}</TableCell>
                  <TableCell>{r.ratePct == null ? "—" : `${r.ratePct}%`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
