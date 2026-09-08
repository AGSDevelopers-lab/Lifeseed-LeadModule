import { NextResponse } from "next/server";
import { z } from "zod";

import { followUpFlagOffResponse, leadV2Error } from "@/lib/leads/application/follow-up-http";
import {
  rescheduleFollowUp,
  serializeFollowUp,
  withLiveFollowUp,
} from "@/lib/leads/application/follow-up";
import { requirePermission } from "@/lib/rbac";
import { permissionGranted, permissionsForRoles } from "@/lib/rbac-permissions";

const bodySchema = z.object({
  dueAt: z.string().min(1),
  reason: z.string().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const flagged = followUpFlagOffResponse();
  if (flagged) return flagged;
  try {
    const session = await requirePermission("follow_up.reschedule");
    const { id } = await context.params;
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "dueAt is required" } },
        { status: 400 },
      );
    }
    const { deps } = await withLiveFollowUp(id);
    const { previous, next } = await rescheduleFollowUp(
      {
        followUpId: id,
        actor: { userId: session.userId, roles: session.roles, siteId: session.siteId },
        dueAt: new Date(parsed.data.dueAt),
        reason: parsed.data.reason ?? null,
        allowAny: permissionGranted(
          permissionsForRoles(session.roles),
          "follow_up.update.any",
        ),
      },
      deps,
    );
    return NextResponse.json({
      ok: true,
      previous: serializeFollowUp(previous),
      followUp: serializeFollowUp(next),
    });
  } catch (err) {
    return leadV2Error(err);
  }
}
