import { redirect } from "next/navigation";

import {
  DncForm,
  DncRemoveButton,
  formatWhen,
} from "@/app/(portals)/telecaller/do-not-call/dnc-form";
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

  const rows = await prisma.leadDoNotCall.findMany({
    where: { removedAt: null },
    orderBy: { addedAt: "desc" },
    take: 100,
  });

  const canAdd = permissionGranted(
    permissionsForRoles(session.roles),
    "dnc.add",
  );
  const canRemove = permissionGranted(
    permissionsForRoles(session.roles),
    "dnc.remove",
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Do Not Call</h1>
      {canAdd && <DncForm canRemove={canRemove} />}
      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Until</TableHead>
              <TableHead>Removal authority</TableHead>
              {canRemove ? <TableHead /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{r.channel}</TableCell>
                <TableCell>{r.normalisedValue}</TableCell>
                <TableCell className="text-xs">{r.email ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.reason}</TableCell>
                <TableCell className="text-xs">{r.source}</TableCell>
                <TableCell className="text-xs">{formatWhen(r.effectiveFrom)}</TableCell>
                <TableCell className="text-xs">{formatWhen(r.effectiveUntil)}</TableCell>
                <TableCell className="text-xs">{r.removalAuthorityUserId ?? "—"}</TableCell>
                {canRemove ? (
                  <TableCell>
                    <DncRemoveButton id={r.id} />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
