import Link from "next/link";
import { redirect } from "next/navigation";
import { DrfState } from "@prisma/client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ACTIVE_CYCLE_STATES, CYCLE_EVENT_LABEL, nextExpectedEvent } from "@/lib/embryology/labels";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import { cn } from "@/lib/utils";

export default async function ClinicCyclesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "cycle.list")) {
    redirect("/clinic");
  }
  if (!session.clinicId) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Cycles</h1>
        <p className="text-sm text-stone-600">
          Your user is not linked to a clinic.
        </p>
      </div>
    );
  }

  const rows = await prisma.dRF.findMany({
    where: {
      clinicId: session.clinicId,
      state: { in: [...ACTIVE_CYCLE_STATES] as DrfState[] },
    },
    include: {
      cohort: true,
      cycleEvents: { orderBy: { occurredAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const donorIds = rows
    .map((r) => r.allocatedDonorId)
    .filter((id): id is string => Boolean(id));
  const donors = await prisma.donor.findMany({
    where: { id: { in: donorIds } },
    select: { id: true, donorCode: true, type: true },
  });
  const donorMap = new Map(donors.map((d) => [d.id, d]));

  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Cycles</h1>
        <p className="text-sm text-stone-600">
          L2 embryology tracking for allocated / in-cycle DRFs (Bank coordination
          role — ops happen at clinic).
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DRF</TableHead>
              <TableHead>Donor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Phase</TableHead>
              <TableHead>Last event</TableHead>
              <TableHead>Next expected</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-stone-500">
                  No active cycles.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const last = r.cycleEvents[0];
              const lastAt = last?.occurredAt ?? r.deliveredAt ?? r.updatedAt;
              const stale = now - lastAt.getTime() > SEVEN_DAYS;
              const phase = r.cohort?.currentPhase ?? "E0";
              const next = nextExpectedEvent(phase);
              const donor = r.allocatedDonorId
                ? donorMap.get(r.allocatedDonorId)
                : null;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.drfNumber}</TableCell>
                  <TableCell className="text-xs">
                    {donor?.donorCode ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">{r.type}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-medium",
                        stale
                          ? "bg-amber-100 text-amber-900"
                          : "bg-emerald-50 text-emerald-900",
                      )}
                    >
                      {phase}
                      {stale ? " · ownership?" : ""}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {last
                      ? `${CYCLE_EVENT_LABEL[last.eventType]} · ${lastAt.toISOString().slice(0, 10)}`
                      : lastAt.toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {CYCLE_EVENT_LABEL[next]}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/clinic/cycles/${r.id}`}
                      className="text-sm text-emerald-900 hover:underline"
                    >
                      Open
                    </Link>
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
