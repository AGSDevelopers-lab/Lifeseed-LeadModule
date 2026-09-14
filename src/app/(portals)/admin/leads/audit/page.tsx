import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listLeadAudit } from "@/lib/leads/application/lead-audit-read";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export default async function LeadAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    entityId?: string;
    actorUserId?: string;
    action?: string;
    from?: string;
    to?: string;
    cursor?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "audit.view")) {
    redirect("/admin/leads");
  }
  const sp = await searchParams;
  const page = await listLeadAudit({
    entityId: sp.entityId,
    actorUserId: sp.actorUserId,
    action: sp.action,
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to) : undefined,
    cursor: sp.cursor,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Lead audit</h1>
        <p className="text-sm text-stone-600">
          Read-only, lead-module AuditLog.{" "}
          <Link href="/admin/leads" className="text-emerald-900 hover:underline">
            Back to leads
          </Link>
        </p>
      </div>
      <form className="flex flex-wrap gap-2 text-sm" method="get">
        <input
          name="entityId"
          defaultValue={sp.entityId ?? ""}
          placeholder="Lead / entity id"
          className="rounded-md border border-stone-300 px-2 py-1"
        />
        <input
          name="actorUserId"
          defaultValue={sp.actorUserId ?? ""}
          placeholder="Actor user id"
          className="rounded-md border border-stone-300 px-2 py-1"
        />
        <input
          name="action"
          defaultValue={sp.action ?? ""}
          placeholder="Action"
          className="rounded-md border border-stone-300 px-2 py-1"
        />
        <input
          name="from"
          type="datetime-local"
          defaultValue={sp.from ?? ""}
          className="rounded-md border border-stone-300 px-2 py-1"
        />
        <input
          name="to"
          type="datetime-local"
          defaultValue={sp.to ?? ""}
          className="rounded-md border border-stone-300 px-2 py-1"
        />
        <button type="submit" className="rounded-md bg-emerald-800 px-3 py-1 text-white">
          Filter
        </button>
      </form>
      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Entity id</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>After (redacted)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-stone-500">
                  No audit rows
                </TableCell>
              </TableRow>
            )}
            {page.items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{r.timestamp.slice(0, 19)}</TableCell>
                <TableCell className="text-xs">{r.action}</TableCell>
                <TableCell className="text-xs">{r.entityType}</TableCell>
                <TableCell className="font-mono text-xs">{r.entityId}</TableCell>
                <TableCell className="font-mono text-xs">{r.actorUserId ?? "—"}</TableCell>
                <TableCell className="max-w-xs truncate font-mono text-[10px] text-stone-600">
                  {JSON.stringify(r.afterJson)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {page.nextCursor && (
        <Link
          href={`/admin/leads/audit?${new URLSearchParams({
            ...(sp.entityId ? { entityId: sp.entityId } : {}),
            ...(sp.actorUserId ? { actorUserId: sp.actorUserId } : {}),
            ...(sp.action ? { action: sp.action } : {}),
            ...(sp.from ? { from: sp.from } : {}),
            ...(sp.to ? { to: sp.to } : {}),
            cursor: page.nextCursor,
          }).toString()}`}
          className="text-sm text-emerald-900 hover:underline"
        >
          Next page
        </Link>
      )}
    </div>
  );
}
