import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { prismaOutboxRepository } from "@/lib/leads/adapters/prisma-outbox";
import { isLeadOutboxEnabled } from "@/lib/leads/application/feature-flag";
import { renderPrometheusMetrics } from "@/lib/leads/application/consumers/analytics-consumer";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

function ist(d: Date | null): string {
  return d
    ? d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    : "—";
}

export default async function AdminLeadCrmMonitorPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const perms = permissionsForRoles(session.roles);
  if (
    !permissionGranted(perms, "crm.sync.manual") &&
    !permissionGranted(perms, "lead.list")
  ) {
    redirect("/admin/leads");
  }

  const stats = await prismaOutboxRepository.stats();
  const dispatcherOn = isLeadOutboxEnabled();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">CRM sync monitor</h1>
          <p className="text-sm text-stone-600">
            Outbox lag and DLQ visibility (B06). Real CRM adapters ship in B16.
            Dispatcher is {dispatcherOn ? "on" : "off"} (
            <code>LEAD_OUTBOX_ENABLED</code>
            ).
          </p>
        </div>
        <Link href="/admin/leads" className="text-sm text-emerald-900 hover:underline">
          ← Leads
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-stone-500">Outbox lag</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {stats.pendingLagSeconds == null ? "—" : `${stats.pendingLagSeconds}s`}
            <p className="mt-1 text-xs font-normal text-stone-500">
              Max age of PENDING rows
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-stone-500">DLQ</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {stats.dlqCount}
            <p className="mt-1 text-xs font-normal text-stone-500">
              Dead-letter events ({stats.deadCount} marked DEAD)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-stone-500">Last dispatch</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {ist(stats.lastDispatchAt)}
            <p className="mt-1 text-xs font-normal text-stone-500">
              Last published {ist(stats.lastPublishedAt)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-stone-500">Queue</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>PENDING {stats.pendingCount}</p>
            <p>IN_FLIGHT {stats.inFlightCount}</p>
            <p>FAILED {stats.failedCount}</p>
            <p>PUBLISHED {stats.publishedCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-stone-500">Analytics counters (process)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-stone-700">
            {renderPrometheusMetrics()}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
