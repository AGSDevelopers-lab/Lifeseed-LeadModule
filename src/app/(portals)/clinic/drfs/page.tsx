import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/primitives";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { DRF_STATE_LABEL } from "@/lib/drf-state";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export default async function ClinicDrfsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "drf.list")) {
    redirect("/clinic");
  }
  if (!session.clinicId) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">DRFs</h1>
        <p className="text-sm text-stone-600">
          Your user is not linked to a clinic. Ask bank admin to set clinicId.
        </p>
      </div>
    );
  }

  const rows = await prisma.dRF.findMany({
    where: { clinicId: session.clinicId },
    include: { site: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Our DRFs</h1>
          <p className="text-sm text-stone-600">
            Requisitions for your clinic only.
          </p>
        </div>
        {permissionGranted(
          permissionsForRoles(session.roles),
          "drf.create",
        ) && (
          <Link href="/clinic/drfs/new">
            <Button>New DRF</Button>
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DRF</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-stone-500">
                  No DRFs yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.drfNumber}</TableCell>
                <TableCell className="text-xs">{r.type}</TableCell>
                <TableCell>{r.priority}</TableCell>
                <TableCell>{DRF_STATE_LABEL[r.state]}</TableCell>
                <TableCell>{r.site.code}</TableCell>
                <TableCell className="text-xs">
                  {r.createdAt.toISOString().slice(0, 10)}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/clinic/drfs/${r.id}`}
                    className="text-sm text-emerald-900 hover:underline"
                  >
                    View
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
