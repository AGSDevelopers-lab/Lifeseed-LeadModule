import { NextResponse } from "next/server";
import { z } from "zod";

import { followUpFlagOffResponse, leadV2Error } from "@/lib/leads/application/follow-up-http";
import {
  completeFollowUp,
  serializeFollowUp,
  withLiveFollowUp,
} from "@/lib/leads/application/follow-up";
import { requirePermission } from "@/lib/rbac";
import { permissionGranted, permissionsForRoles } from "@/lib/rbac-permissions";

const bodySchema = z.object({
  outcome: z.string().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const flagged = followUpFlagOffResponse();
  if (flagged) return flagged;
  try {
    const session = await requirePermission("follow_up.complete.own");
    const { id } = await context.params;
    let json: unknown = {};
    try {
      json = await request.json();
    } catch {
      json = {};
    }
    const parsed = bodySchema.safeParse(json);
    const { deps } = await withLiveFollowUp(id);
    const row = await completeFollowUp(
      {
        followUpId: id,
        actor: { userId: session.userId, roles: session.roles, siteId: session.siteId },
        outcome: parsed.success ? parsed.data.outcome ?? null : null,
        allowAny: permissionGranted(
          permissionsForRoles(session.roles),
          "follow_up.update.any",
        ),
      },
      deps,
    );
    return NextResponse.json({ ok: true, followUp: serializeFollowUp(row) });
  } catch (err) {
    return leadV2Error(err);
  }
}
