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

export default async function AdminDncPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "dnc.list")) {
    redirect("/admin/leads");
  }

  const rows = await prisma.leadDoNotCallList.findMany({
    orderBy: { addedAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Do Not Call</h1>
      {permissionGranted(permissionsForRoles(session.roles), "dnc.add") && (
        <DncForm />
      )}
      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Added</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.phone}</TableCell>
                <TableCell className="text-xs">{r.reason}</TableCell>
                <TableCell className="text-xs">{r.source}</TableCell>
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
