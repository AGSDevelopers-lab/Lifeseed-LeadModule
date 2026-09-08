import { NextResponse } from "next/server";
import { z } from "zod";

import {
  permissionForActivityType,
  recordLeadActivity,
  parseActivityType,
} from "@/lib/leads/application/activity";
import { isLeadFollowUpEnabled } from "@/lib/leads/application/feature-flag";
import { leadV2Error } from "@/lib/leads/application/follow-up-http";
import { LeadActivityType } from "@/lib/leads/domain/enums";
import { requirePermission } from "@/lib/rbac";

const bodySchema = z.object({
  activityType: z.string().min(1),
  summary: z.string().optional(),
  outcome: z.string().optional(),
  nextAction: z.string().optional(),
  nextActionDueAt: z.string().optional(),
  channel: z.enum(["INBOUND", "OUTBOUND", "SYSTEM"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "activityType is required" } },
        { status: 400 },
      );
    }
    const activityType = parseActivityType(parsed.data.activityType);
    if (activityType === LeadActivityType.FOLLOW_UP && !isLeadFollowUpEnabled()) {
      return NextResponse.json(
        { error: { code: "FEATURE_OFF", message: "Lead follow-up is disabled" } },
        { status: 404 },
      );
    }
    const session = await requirePermission(permissionForActivityType(activityType));
    const { id: leadId } = await context.params;
    const created = await recordLeadActivity({
      leadId,
      actor: { userId: session.userId, roles: session.roles, siteId: session.siteId },
      activityType,
      summary: parsed.data.summary ?? null,
      outcome: parsed.data.outcome ?? null,
      nextAction: parsed.data.nextAction ?? null,
      nextActionDueAt: parsed.data.nextActionDueAt
        ? new Date(parsed.data.nextActionDueAt)
        : null,
      channel: parsed.data.channel ?? null,
      metadata: parsed.data.metadata ?? null,
      relatedEntityType: parsed.data.relatedEntityType ?? null,
      relatedEntityId: parsed.data.relatedEntityId ?? null,
    });
    return NextResponse.json({ ok: true, activity: created });
  } catch (err) {
    return leadV2Error(err);
  }
}
