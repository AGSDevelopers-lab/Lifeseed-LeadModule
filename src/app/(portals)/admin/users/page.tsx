import { redirect } from "next/navigation";

import { AssignRoleDialog } from "./assign-role-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { getSession, permissionGranted, permissionsForRoles } from "@/lib/rbac";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const held = permissionsForRoles(session.roles);
  if (!permissionGranted(held, "user.list")) {
    redirect("/admin");
  }

  const users = await prisma.user.findMany({
    include: { roles: true },
    orderBy: { email: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Users</h1>
          <p className="text-sm text-stone-600">
            Role assignments for Bank Admin operators and portal users.
          </p>
        </div>
        <AssignRoleDialog
          users={users.map((u) => ({ id: u.id, email: u.email }))}
        />
      </div>

      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>MFA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>{user.phone}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {user.roles.map((r) => r.role).join(", ") || "—"}
                </TableCell>
                <TableCell>{user.isActive ? "Yes" : "No"}</TableCell>
                <TableCell>{user.mfaEnabled ? "Yes" : "No"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
