import { LeadEvent, type LeadEvent as LeadEventValue } from "../enums";
import type { TransitionPayload } from "./types";

export type StateMachineEvent = LeadEventValue;

export function createLeadEvent(
  event: StateMachineEvent,
  payload: TransitionPayload = {},
): { event: StateMachineEvent; payload: TransitionPayload } {
  return { event, payload };
}

export const STATE_MACHINE_EVENTS: readonly StateMachineEvent[] = [
  LeadEvent.intake,
  LeadEvent.assign,
  LeadEvent.reassign,
  LeadEvent.claim,
  LeadEvent.disposition_qualified,
  LeadEvent.disposition_not_interested,
  LeadEvent.disposition_callback,
  LeadEvent.disposition_not_reachable,
  LeadEvent.disposition_wrong_number,
  LeadEvent.disposition_do_not_call,
  LeadEvent.book_counselling,
  LeadEvent.session_attended,
  LeadEvent.session_no_show,
  LeadEvent.session_cancelled,
  LeadEvent.convert_donor,
  LeadEvent.convert_recipient,
  LeadEvent.archive,
  LeadEvent.unarchive,
  LeadEvent.reactivate,
  LeadEvent.expire_by_retention,
  LeadEvent.merge_loser,
  LeadEvent.mark_lost,
];
