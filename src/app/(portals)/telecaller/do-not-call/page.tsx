import { redirect } from "next/navigation";

import { DncForm } from "@/app/(portals)/telecaller/do-not-call/dnc-form";
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

export default async function DoNotCallPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "dnc.list")) {
    redirect("/telecaller/dashboard");
  }

  const rows = await prisma.leadDoNotCallList.findMany({
    orderBy: { addedAt: "desc" },
    take: 100,
  });

  const canAdd = permissionGranted(
    permissionsForRoles(session.roles),
    "dnc.add",
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Do Not Call</h1>
      {canAdd && <DncForm />}
      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Added</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.phone}</TableCell>
                <TableCell className="text-xs">{r.email ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.reason}</TableCell>
                <TableCell className="text-xs">
                  {r.addedAt.toISOString().slice(0, 10)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
