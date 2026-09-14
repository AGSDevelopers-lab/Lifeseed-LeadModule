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
import { loadTelecallerQueue } from "@/lib/leads/adapters/prisma-lead-repository";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { QueueDispositionControl } from "./queue-disposition-control";

export default async function TelecallerQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; personType?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(permissionsForRoles(session.roles), "telecaller.queue")
  ) {
    redirect("/telecaller/dashboard");
  }
  const actor = await resolveLeadActor();
  if (!actor) redirect("/login");
  const sp = await searchParams;

  const rows = await loadTelecallerQueue(actor, {
    tier: sp.tier,
    personType: sp.personType,
  });

  const now = Date.now();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My queue</h1>
        <p className="text-sm text-stone-600">SLA urgency first, then tier</p>
      </div>
      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>SLA</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead>Disposition</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-stone-500">
                  Queue empty
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const due = r.slaResponseDueAt?.getTime();
              const overdue = due != null && due < now;
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/telecaller/leads/${r.id}`}
                      className="font-medium text-emerald-900 hover:underline"
                    >
                      {r.leadCode}
                    </Link>
                  </TableCell>
                  <TableCell>{r.fullName ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.phone ?? "—"}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs",
                        r.tier === "HOT" && "bg-red-100 text-red-900",
                        r.tier === "WARM" && "bg-amber-100 text-amber-900",
                        r.tier === "COLD" && "bg-sky-100 text-sky-900",
                      )}
                    >
                      {r.tier}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-xs",
                      overdue && "font-medium text-red-700",
                    )}
                  >
                    {r.slaResponseDueAt
                      ? r.slaResponseDueAt.toISOString().slice(0, 16)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.lastActivityAt.toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    <QueueDispositionControl leadId={r.id} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
