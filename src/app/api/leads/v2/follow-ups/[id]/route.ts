import { NextResponse } from "next/server";
import { z } from "zod";

import { followUpFlagOffResponse, leadV2Error } from "@/lib/leads/application/follow-up-http";
import {
  patchFollowUp,
  serializeFollowUp,
  withLiveFollowUp,
} from "@/lib/leads/application/follow-up";
import { FollowUpPriority } from "@/lib/leads/domain/enums";
import { requirePermission } from "@/lib/rbac";
import { permissionGranted, permissionsForRoles } from "@/lib/rbac-permissions";

const bodySchema = z.object({
  reason: z.string().nullable().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  dueAt: z.string().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const flagged = followUpFlagOffResponse();
  if (flagged) return flagged;
  try {
    const session = await requirePermission("follow_up.update.own");
    const { id } = await context.params;
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid body" } },
        { status: 400 },
      );
    }
    const { deps } = await withLiveFollowUp(id);
    const allowAny = permissionGranted(
      permissionsForRoles(session.roles),
      "follow_up.update.any",
    );
    const row = await patchFollowUp(
      {
        followUpId: id,
        actor: { userId: session.userId, roles: session.roles, siteId: session.siteId },
        reason: parsed.data.reason,
        priority: parsed.data.priority as
          | (typeof FollowUpPriority)[keyof typeof FollowUpPriority]
          | undefined,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined,
        allowAny,
      },
      deps,
    );
    return NextResponse.json({ ok: true, followUp: serializeFollowUp(row) });
  } catch (err) {
    return leadV2Error(err);
  }
}
