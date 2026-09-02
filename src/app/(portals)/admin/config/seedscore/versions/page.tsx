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

export default async function RubricVersionsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(permissionsForRoles(session.roles), "seedscore.view") &&
    !permissionGranted(
      permissionsForRoles(session.roles),
      "seedscore.rubric.publish",
    )
  ) {
    redirect("/admin");
  }

  const versions = await prisma.rubricVersion.findMany({
    orderBy: { versionNumber: "desc" },
    take: 50,
  });

  const publisherIds = versions
    .map((v) => v.publishedByUserId)
    .filter((id): id is string => Boolean(id));
  const publishers = await prisma.user.findMany({
    where: { id: { in: publisherIds } },
    select: { id: true, email: true },
  });
  const emailMap = new Map(publishers.map((p) => [p.id, p.email]));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/config/seedscore"
          className="text-sm text-emerald-900 hover:underline"
        >
          ← Rubric
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Rubric versions</h1>
      </div>
      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>By</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-stone-500">
                  No versions published yet.
                </TableCell>
              </TableRow>
            )}
            {versions.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">v{v.versionNumber}</TableCell>
                <TableCell className="text-xs">
                  {v.publishedAt.toISOString().slice(0, 16).replace("T", " ")} UTC
                </TableCell>
                <TableCell className="text-xs">
                  {v.publishedByUserId
                    ? (emailMap.get(v.publishedByUserId) ?? "—")
                    : "—"}
                </TableCell>
                <TableCell>{v.isActive ? "Yes" : "No"}</TableCell>
                <TableCell className="text-xs">{v.notes ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
