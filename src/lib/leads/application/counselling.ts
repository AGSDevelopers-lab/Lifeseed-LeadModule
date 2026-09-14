import type { ActorContext } from "../domain/ports/shared";
import { LeadEvent } from "../domain/enums";
import { applyLeadEvent } from "./apply-lead-event";
import type { TransitionPayload } from "../domain/state-machine/types";
import { bookCounsellingSession, recordCounsellingSession } from "./commands";
import {
  COUNSELLING_CANCEL_PERMISSION,
  COUNSELLING_RESCHEDULE_PERMISSION,
} from "./counselling-permissions";

export { bookCounsellingSession, recordCounsellingSession };

export async function rescheduleCounsellingBooking(
  leadId: string,
  actor: ActorContext,
  payload: TransitionPayload,
) {
  return applyLeadEvent({
    leadId,
    event: LeadEvent.session_cancelled,
    actor,
    permission: COUNSELLING_RESCHEDULE_PERMISSION,
    payload: { ...payload, cancelMode: "reschedule" },
    facts: { bookingInFuture: true },
    forcePersist: true,
  });
}

export async function cancelCounsellingBooking(
  leadId: string,
  actor: ActorContext,
  payload: TransitionPayload = {},
) {
  return applyLeadEvent({
    leadId,
    event: LeadEvent.session_cancelled,
    actor,
    permission: COUNSELLING_CANCEL_PERMISSION,
    payload: { ...payload, cancelMode: "full" },
    facts: { bookingInFuture: true },
    forcePersist: true,
  });
}

export async function recordCounsellingOutcome(
  leadId: string,
  actor: ActorContext,
  payload: TransitionPayload,
) {
  return applyLeadEvent({
    leadId,
    event: LeadEvent.session_attended,
    actor,
    permission: "counselling.outcome.record",
    payload,
    forcePersist: true,
  });
}
