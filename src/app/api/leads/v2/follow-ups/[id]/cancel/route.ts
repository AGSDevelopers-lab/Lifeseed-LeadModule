import { NextResponse } from "next/server";
import { z } from "zod";

import { followUpFlagOffResponse, leadV2Error } from "@/lib/leads/application/follow-up-http";
import {
  cancelFollowUp,
  serializeFollowUp,
  withLiveFollowUp,
} from "@/lib/leads/application/follow-up";
import { requirePermission } from "@/lib/rbac";
import { permissionGranted, permissionsForRoles } from "@/lib/rbac-permissions";

const bodySchema = z.object({
  reason: z.string().min(1),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const flagged = followUpFlagOffResponse();
  if (flagged) return flagged;
  try {
    const session = await requirePermission("follow_up.cancel.own");
    const { id } = await context.params;
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "reason is required" } },
        { status: 400 },
      );
    }
    const held = permissionsForRoles(session.roles);
    const { deps } = await withLiveFollowUp(id);
    const row = await cancelFollowUp(
      {
        followUpId: id,
        actor: { userId: session.userId, roles: session.roles, siteId: session.siteId },
        reason: parsed.data.reason,
        allowAny:
          permissionGranted(held, "follow_up.cancel.any") ||
          permissionGranted(held, "follow_up.update.any"),
      },
      deps,
    );
    return NextResponse.json({ ok: true, followUp: serializeFollowUp(row) });
  } catch (err) {
    return leadV2Error(err);
  }
}
