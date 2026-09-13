import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/rbac";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { LeadDomainError } from "@/lib/leads/domain/errors";
import { LeadEvent, type LeadEvent as LeadEventName } from "@/lib/leads/domain/enums";
import { applyLeadEvent } from "@/lib/leads/application/apply-lead-event";
import { mapWorkflowPermission } from "@/lib/leads/application/guard-facts";
import type { Permission } from "@/lib/rbac";

const bodySchema = z.object({
  reason: z.string().optional(),
  assigneeUserId: z.string().optional(),
  dueAt: z.string().optional(),
  counsellorUserId: z.string().optional(),
  scheduledAt: z.string().optional(),
  mode: z.string().optional(),
  winnerLeadId: z.string().optional(),
  notes: z.string().optional(),
  cancelMode: z.enum(["reschedule", "full"]).optional(),
}).passthrough();

const EVENT_PERM: Partial<Record<LeadEventName, string>> = {
  intake: "lead.create",
  assign: "lead.assign",
  reassign: "lead.reassign",
  claim: "telecaller.disposition",
  disposition_qualified: "telecaller.disposition",
  disposition_not_interested: "telecaller.disposition",
  disposition_callback: "telecaller.disposition",
  disposition_not_reachable: "telecaller.disposition",
  disposition_wrong_number: "telecaller.disposition",
  disposition_do_not_call: "telecaller.disposition",
  book_counselling: "counselling.book",
  session_attended: "counsellor.mark_attended",
  session_no_show: "counsellor.mark_attended",
  session_cancelled: "counselling.cancel",
  convert_donor: "lead.convert",
  convert_recipient: "lead.convert",
  archive: "lead.archive",
  unarchive: "lead.archive",
  reactivate: "lead.archive",
  expire_by_retention: "lead.archive",
  merge_loser: "lead.assign",
  mark_lost: "lead.archive",
};

export async function handleLeadTransition(
  leadId: string,
  eventRaw: string,
  request: Request,
): Promise<Response> {
  const event = eventRaw as LeadEventName;
  if (!(Object.values(LeadEvent) as string[]).includes(event)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Unknown event" } },
      { status: 400 },
    );
  }
  const perm = EVENT_PERM[event] ?? "lead.view";
  try {
    await requirePermission(mapWorkflowPermission(perm) as Permission);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const actor = await resolveLeadActor();
  if (!actor) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }
  let json: unknown = {};
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid body" } },
      { status: 400 },
    );
  }
  const b = parsed.data;
  try {
    const result = await applyLeadEvent({
      leadId,
      event,
      actor,
      permission: perm,
      payload: {
        reason: b.reason,
        assigneeUserId: b.assigneeUserId,
        dueAt: b.dueAt ? new Date(b.dueAt) : null,
        counsellorUserId: b.counsellorUserId,
        scheduledAt: b.scheduledAt ? new Date(b.scheduledAt) : null,
        mode: b.mode,
        winnerLeadId: b.winnerLeadId,
        notes: b.notes,
        cancelMode: b.cancelMode,
      },
    });
    return NextResponse.json({
      ok: true,
      status: result.result.nextStatus,
      transitionId: result.result.transitionId,
    });
  } catch (err) {
    if (err instanceof LeadDomainError) {
      const status =
        err.code === "LEAD_REACTIVATION_WINDOW_EXPIRED" ||
        err.code === "LEAD_STATE_TRANSITION_NOT_ALLOWED" ||
        err.code === "LEAD_DUPLICATE_CONVERSION"
          ? 409
          : err.code === "LEAD_OWNERSHIP_DENIED"
            ? 403
            : 400;
      return NextResponse.json(
        { error: { code: err.code, message: err.message, details: err.context } },
        { status },
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
      { status: 500 },
    );
  }
}
