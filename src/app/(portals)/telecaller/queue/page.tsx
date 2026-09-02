import Link from "next/link";
import { redirect } from "next/navigation";
import { LeadStatus, LeadTier } from "@prisma/client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import { cn } from "@/lib/utils";

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
  const sp = await searchParams;

  const rows = await prisma.lead.findMany({
    where: {
      assignedTelecallerId: session.userId,
      status: {
        notIn: [
          LeadStatus.CONVERTED,
          LeadStatus.LOST,
          LeadStatus.EXPIRED_AUTO_PURGED,
          LeadStatus.DO_NOT_CALL,
        ],
      },
      ...(sp.tier ? { tier: sp.tier as LeadTier } : {}),
      ...(sp.personType
        ? { personType: sp.personType as "DONOR" | "RECIPIENT" }
        : {}),
    },
    orderBy: [{ slaResponseDueAt: "asc" }, { tier: "asc" }],
    take: 100,
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-stone-500">
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
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
