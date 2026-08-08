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
import { ACTIVE_CYCLE_STATES } from "@/lib/embryology/labels";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export default async function ClinicCohortsListPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "cohort.view")) {
    redirect("/clinic");
  }
  if (!session.clinicId) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Cohorts</h1>
        <p className="text-sm text-stone-600">
          Your user is not linked to a clinic.
        </p>
      </div>
    );
  }

  const cohorts = await prisma.embryoCohort.findMany({
    where: {
      clinicId: session.clinicId,
      drf: { state: { in: [...ACTIVE_CYCLE_STATES] as DrfState[] } },
    },
    include: {
      drf: { select: { id: true, drfNumber: true, type: true } },
      embryos: { select: { id: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Cohorts</h1>
        <p className="text-sm text-stone-600">
          Per-embryo tracking for active clinic cycles.
        </p>
      </div>
      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DRF</TableHead>
              <TableHead>Phase</TableHead>
              <TableHead>Oocytes</TableHead>
              <TableHead>2PN</TableHead>
              <TableHead>Embryos</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cohorts.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-stone-500">
                  No cohorts yet.
                </TableCell>
              </TableRow>
            )}
            {cohorts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.drf.drfNumber}</TableCell>
                <TableCell>{c.currentPhase}</TableCell>
                <TableCell>{c.oocytesRetrieved ?? "—"}</TableCell>
                <TableCell>{c.day1_2pnCount ?? "—"}</TableCell>
                <TableCell>{c.embryos.length}</TableCell>
                <TableCell>
                  <Link
                    href={`/clinic/cohorts/${c.drfId}`}
                    className="text-sm text-emerald-900 hover:underline"
                  >
                    Manage
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
