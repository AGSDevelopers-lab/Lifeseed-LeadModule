import { redirect } from "next/navigation";

import {
  DoNotCallClient,
  type DncListRow,
} from "@/app/(portals)/telecaller/do-not-call/do-not-call-client";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

function toRow(r: {
  id: string;
  channel: string;
  normalisedValue: string;
  email: string | null;
  reason: string;
  source: string;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  removalAuthorityUserId: string | null;
  createdByUserId: string;
}): DncListRow {
  return {
    id: r.id,
    channel: r.channel,
    normalisedValue: r.normalisedValue,
    email: r.email,
    reason: r.reason,
    source: r.source,
    effectiveFrom: r.effectiveFrom.toISOString(),
    effectiveUntil: r.effectiveUntil?.toISOString() ?? null,
    removalAuthorityUserId: r.removalAuthorityUserId,
    createdByUserId: r.createdByUserId,
  };
}

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
    <DoNotCallClient
      rows={rows.map(toRow)}
      canAdd={canAdd}
      canRemove={canRemove}
      variant="telecaller"
    />
  );
}
