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
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export default async function TelecallerLeadsListPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "lead.view")) {
    redirect("/telecaller/dashboard");
  }

  const rows = await prisma.lead.findMany({
    where: {
      OR: [
        { assignedTelecallerId: session.userId },
        // OPS / admin with lead.list see all via admin portal
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My leads</h1>
        <Link
          href="/telecaller/leads/new"
          className="text-sm text-emerald-900 hover:underline"
        >
          Add lead
        </Link>
      </div>
      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link
                    href={`/telecaller/leads/${r.id}`}
                    className="text-emerald-900 hover:underline"
                  >
                    {r.leadCode}
                  </Link>
                </TableCell>
                <TableCell>{r.fullName}</TableCell>
                <TableCell>{r.tier}</TableCell>
                <TableCell className="text-xs">{r.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
