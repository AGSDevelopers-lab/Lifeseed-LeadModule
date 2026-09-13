import type { ActorContext } from "../domain/ports/shared";
import { LeadEvent } from "../domain/enums";
import { applyLeadEvent } from "./apply-lead-event";
import type { TransitionPayload } from "../domain/state-machine/types";

export async function qualifyLead(
  leadId: string,
  actor: ActorContext,
  event:
    | "disposition_qualified"
    | "disposition_not_interested"
    | "disposition_callback"
    | "disposition_not_reachable"
    | "disposition_wrong_number"
    | "disposition_do_not_call",
  payload: TransitionPayload,
) {
  return applyLeadEvent({
    leadId,
    event: LeadEvent[event],
    actor,
    permission: "lead.disposition",
    payload,
  });
}

export async function assignLeadToUser(
  leadId: string,
  actor: ActorContext,
  assigneeUserId: string,
  payload: TransitionPayload = {},
) {
  const {
    assertExplicitAssigneeAllowed,
    computeGenuineAssigneeAvailable,
    loadLeadForAssignment,
  } = await import("./assignment-eligibility");
  const lead = await loadLeadForAssignment(leadId, actor);
  if (!lead) throw new Error("Lead not found");
  await assertExplicitAssigneeAllowed(actor, assigneeUserId, lead, "assign");
  // Temporary fallback semantics pending IAM Module 12 — not a final availability model.
  const assigneeAvailable = await computeGenuineAssigneeAvailable(lead, actor);
  return applyLeadEvent({
    leadId,
    event: LeadEvent.assign,
    actor,
    permission: "lead.assign",
    payload: { ...payload, assigneeUserId },
    facts: { assigneeAvailable },
  });
}

export async function reassignLeadToUser(
  leadId: string,
  actor: ActorContext,
  assigneeUserId: string,
  reason: string,
) {
  const {
    assertExplicitAssigneeAllowed,
    computeGenuineAssigneeAvailable,
    loadLeadForAssignment,
  } = await import("./assignment-eligibility");
  const lead = await loadLeadForAssignment(leadId, actor);
  if (!lead) throw new Error("Lead not found");
  await assertExplicitAssigneeAllowed(actor, assigneeUserId, lead, "reassign");
  // Temporary fallback semantics pending IAM Module 12 — not a final availability model.
  const assigneeAvailable = await computeGenuineAssigneeAvailable(lead, actor);
  return applyLeadEvent({
    leadId,
    event: LeadEvent.reassign,
    actor,
    permission: "lead.reassign",
    payload: { assigneeUserId, reason },
    facts: { assigneeAvailable, reasonPresent: true },
  });
}

export async function claimLead(leadId: string, actor: ActorContext) {
  return applyLeadEvent({
    leadId,
    event: LeadEvent.claim,
    actor,
    permission: "lead.claim",
    facts: { claimAllowed: true },
  });
}

export async function bookCounsellingSession(
  leadId: string,
  actor: ActorContext,
  payload: TransitionPayload,
) {
  return applyLeadEvent({
    leadId,
    event: LeadEvent.book_counselling,
    actor,
    permission: "counselling.book",
    payload,
    facts: { counsellorAvailable: true, personTypeRecipient: true },
    forcePersist: true,
  });
}

export async function recordCounsellingSession(
  leadId: string,
  actor: ActorContext,
  kind: "attended" | "no_show",
  payload: TransitionPayload = {},
) {
  return applyLeadEvent({
    leadId,
    event: kind === "attended" ? LeadEvent.session_attended : LeadEvent.session_no_show,
    actor,
    permission: "counselling.session.record",
    payload,
    facts: { bookingExists: true, sessionRecordAttached: true },
    forcePersist: true,
  });
}

export async function archiveLeadV2(leadId: string, actor: ActorContext, reason: string) {
  return applyLeadEvent({
    leadId,
    event: LeadEvent.archive,
    actor,
    permission: "lead.archive",
    payload: { reason },
    facts: { reasonPresent: true },
  });
}

export async function unarchiveLeadV2(leadId: string, actor: ActorContext, reason: string) {
  return applyLeadEvent({
    leadId,
    event: LeadEvent.unarchive,
    actor,
    permission: "lead.unarchive",
    payload: { reason },
    facts: { reasonPresent: true },
  });
}

export async function reactivateLeadV2(leadId: string, actor: ActorContext, reason: string, lostAt: Date | null) {
  return applyLeadEvent({
    leadId,
    event: LeadEvent.reactivate,
    actor,
    permission: "lead.reactivate",
    payload: { reason },
    facts: { reasonPresent: true, lostAt },
  });
}

export async function expireLeadV2(
  leadId: string,
  actor: ActorContext,
  options?: { forcePersist?: boolean },
) {
  return applyLeadEvent({
    leadId,
    event: LeadEvent.expire_by_retention,
    actor,
    permission: "lead.archive",
    facts: { retentionExpired: true, publicIntake: true, hasPermission: true },
    forcePersist: options?.forcePersist,
  });
}

export async function convertDonorStub(leadId: string, actor: ActorContext, payload: TransitionPayload = {}) {
  return applyLeadEvent({
    leadId,
    event: LeadEvent.convert_donor,
    actor,
    permission: "lead.convert",
    payload,
    facts: { requiredFieldsPresent: true, hasConversion: false },
  });
}

export async function convertRecipientStub(leadId: string, actor: ActorContext, payload: TransitionPayload = {}) {
  return applyLeadEvent({
    leadId,
    event: LeadEvent.convert_recipient,
    actor,
    permission: "lead.convert",
    payload,
    facts: { recommendationRegister: true, hasConversion: false },
  });
}

export async function mergeLoserStub(
  leadId: string,
  actor: ActorContext,
  winnerLeadId: string,
  reason: string,
) {
  return applyLeadEvent({
    leadId,
    event: LeadEvent.merge_loser,
    actor,
    permission: "lead.merge",
    payload: { winnerLeadId, reason },
    facts: { leadMergeExists: true, reasonPresent: true },
  });
}
