import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { prismaOutboxRepository } from "@/lib/leads/adapters/prisma-outbox";
import { isCrmSyncEnabled, isLeadOutboxEnabled } from "@/lib/leads/application/feature-flag";
import { listCrmSyncQueue } from "@/lib/leads/application/crm-sync";
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
  const crmOn = isCrmSyncEnabled();
  const queue = await listCrmSyncQueue({ take: 40 });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">CRM sync monitor</h1>
          <p className="text-sm text-stone-600">
            Canonical path: outbox → CRM consumer → CrmSyncQueue → CrmPort.
            Dispatcher is {dispatcherOn ? "on" : "off"} (
            <code>LEAD_OUTBOX_ENABLED</code>
            ). Sync worker is {crmOn ? "on" : "idle"} (
            <code>CRM_SYNC_ENABLED</code>
            ).
          </p>
        </div>
        <Link href="/admin/leads" className="text-sm text-brand-800 hover:underline">
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
          <CardTitle className="text-sm text-stone-500">CrmSyncQueue (latest)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-stone-500">
                  <th className="py-2 pr-3">Job</th>
                  <th className="py-2 pr-3">Lead</th>
                  <th className="py-2 pr-3">Target</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">External id</th>
                  <th className="py-2 pr-3">Attempts</th>
                </tr>
              </thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr>
                    <td className="py-3 text-stone-500" colSpan={6}>
                      No CRM sync jobs
                    </td>
                  </tr>
                ) : (
                  queue.map((row) => (
                    <tr key={row.id} className="border-b border-stone-100">
                      <td className="py-2 pr-3 font-mono text-xs">{row.id.slice(0, 10)}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{row.entityId.slice(0, 10)}</td>
                      <td className="py-2 pr-3">{row.syncTarget}</td>
                      <td className="py-2 pr-3">{row.status}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{row.externalId ?? "—"}</td>
                      <td className="py-2 pr-3">{row.attempts}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
