import { NextResponse } from "next/server";

import { followUpFlagOffResponse, leadV2Error } from "@/lib/leads/application/follow-up-http";
import { listFollowUpsPrisma, serializeFollowUp } from "@/lib/leads/application/follow-up";
import { canOverrideFollowUp } from "@/lib/leads/application/follow-up";
import type { FollowUpStatus } from "@/lib/leads/domain/enums";
import { requirePermission } from "@/lib/rbac";
import { permissionGranted, permissionsForRoles } from "@/lib/rbac-permissions";

export async function GET(request: Request) {
  const flagged = followUpFlagOffResponse();
  if (flagged) return flagged;
  try {
    const session = await requirePermission("follow_up.list");
    const url = new URL(request.url);
    const owner = url.searchParams.get("owner");
    const statusRaw = url.searchParams.get("status") ?? undefined;
    const dueBefore = url.searchParams.get("dueBefore");
    const dueAfter = url.searchParams.get("dueAfter");
    const leadId = url.searchParams.get("leadId") ?? undefined;
    const held = permissionsForRoles(session.roles);
    const anyScope =
      permissionGranted(held, "follow_up.update.any") || canOverrideFollowUp(session.roles);
    let ownerUserId: string | undefined;
    if (owner === "me" || !anyScope) {
      ownerUserId = session.userId;
    } else if (owner && owner !== "any") {
      ownerUserId = owner;
    }
    const status =
      statusRaw === "due" || statusRaw === "queue"
        ? statusRaw
        : (statusRaw as FollowUpStatus | undefined);
    const rows = await listFollowUpsPrisma({
      ownerUserId,
      status,
      leadId,
      dueBefore: dueBefore ? new Date(dueBefore) : undefined,
      dueAfter: dueAfter ? new Date(dueAfter) : undefined,
    });
    return NextResponse.json({ items: rows.map(serializeFollowUp) });
  } catch (err) {
    return leadV2Error(err);
  }
}
