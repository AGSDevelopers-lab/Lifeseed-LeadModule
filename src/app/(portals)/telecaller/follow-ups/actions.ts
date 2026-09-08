"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  cancelFollowUp,
  completeFollowUp,
  rescheduleFollowUp,
  withLiveFollowUp,
} from "@/lib/leads/application/follow-up";
import { isLeadFollowUpEnabled } from "@/lib/leads/application/feature-flag";
import { requirePermission } from "@/lib/rbac";
import { permissionGranted, permissionsForRoles } from "@/lib/rbac-permissions";

export type FollowUpActionResult = { ok: true } | { ok: false; error: string };

function catchErr(err: unknown): FollowUpActionResult {
  if (err instanceof Response) {
    return { ok: false, error: err.status === 401 ? "Unauthorized" : "Forbidden" };
  }
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: "Unexpected error" };
}

function revalidateFollowUpPages(leadId?: string) {
  revalidatePath("/telecaller/follow-ups");
  if (leadId) revalidatePath(`/telecaller/leads/${leadId}`);
}

export async function completeFollowUpAction(input: {
  id: string;
  outcome?: string;
}): Promise<FollowUpActionResult> {
  if (!isLeadFollowUpEnabled()) return { ok: false, error: "Follow-up is disabled" };
  try {
    const session = await requirePermission("follow_up.complete.own");
    const { deps, row } = await withLiveFollowUp(input.id);
    await completeFollowUp(
      {
        followUpId: input.id,
        actor: { userId: session.userId, roles: session.roles, siteId: session.siteId },
        outcome: input.outcome ?? null,
        allowAny: permissionGranted(permissionsForRoles(session.roles), "follow_up.update.any"),
      },
      deps,
    );
    revalidateFollowUpPages(row.leadId);
    return { ok: true };
  } catch (e) {
    return catchErr(e);
  }
}

export async function rescheduleFollowUpAction(input: {
  id: string;
  dueAt: string;
  reason?: string;
}): Promise<FollowUpActionResult> {
  if (!isLeadFollowUpEnabled()) return { ok: false, error: "Follow-up is disabled" };
  try {
    const session = await requirePermission("follow_up.reschedule");
    const parsed = z.object({ id: z.string(), dueAt: z.string().min(1) }).safeParse(input);
    if (!parsed.success) return { ok: false, error: "New due time is required" };
    const { deps, row } = await withLiveFollowUp(input.id);
    await rescheduleFollowUp(
      {
        followUpId: input.id,
        actor: { userId: session.userId, roles: session.roles, siteId: session.siteId },
        dueAt: new Date(input.dueAt),
        reason: input.reason ?? null,
        allowAny: permissionGranted(permissionsForRoles(session.roles), "follow_up.update.any"),
      },
      deps,
    );
    revalidateFollowUpPages(row.leadId);
    return { ok: true };
  } catch (e) {
    return catchErr(e);
  }
}

export async function cancelFollowUpAction(input: {
  id: string;
  reason: string;
}): Promise<FollowUpActionResult> {
  if (!isLeadFollowUpEnabled()) return { ok: false, error: "Follow-up is disabled" };
  try {
    const session = await requirePermission("follow_up.cancel.own");
    const { deps, row } = await withLiveFollowUp(input.id);
    await cancelFollowUp(
      {
        followUpId: input.id,
        actor: { userId: session.userId, roles: session.roles, siteId: session.siteId },
        reason: input.reason,
        allowAny: permissionGranted(permissionsForRoles(session.roles), "follow_up.cancel.any"),
      },
      deps,
    );
    revalidateFollowUpPages(row.leadId);
    return { ok: true };
  } catch (e) {
    return catchErr(e);
  }
}
