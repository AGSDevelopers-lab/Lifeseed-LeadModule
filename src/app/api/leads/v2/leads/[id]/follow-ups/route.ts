import { NextResponse } from "next/server";
import { z } from "zod";

import { followUpFlagOffResponse, leadV2Error } from "@/lib/leads/application/follow-up-http";
import {
  createFollowUp,
  liveFollowUpDeps,
  serializeFollowUp,
} from "@/lib/leads/application/follow-up";
import { FollowUpPriority, FollowUpType } from "@/lib/leads/domain/enums";
import { requirePermission } from "@/lib/rbac";

const bodySchema = z.object({
  type: z.enum(["CALLBACK", "RECONTACT", "COUNSELLING_REMINDER", "DOC_REQUEST", "CUSTOM"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  reason: z.string().optional(),
  dueAt: z.string().min(1),
  ownerUserId: z.string().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const flagged = followUpFlagOffResponse();
  if (flagged) return flagged;
  try {
    const session = await requirePermission("follow_up.create");
    const { id: leadId } = await context.params;
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "dueAt is required" } },
        { status: 400 },
      );
    }
    const deps = await liveFollowUpDeps();
    const row = await createFollowUp(
      {
        leadId,
        ownerUserId: parsed.data.ownerUserId ?? session.userId,
        actor: { userId: session.userId, roles: session.roles, siteId: session.siteId },
        type: parsed.data.type as (typeof FollowUpType)[keyof typeof FollowUpType] | undefined,
        priority: parsed.data.priority as
          | (typeof FollowUpPriority)[keyof typeof FollowUpPriority]
          | undefined,
        reason: parsed.data.reason ?? null,
        dueAt: new Date(parsed.data.dueAt),
      },
      deps,
    );
    return NextResponse.json({ ok: true, followUp: serializeFollowUp(row) });
  } catch (err) {
    return leadV2Error(err);
  }
}
