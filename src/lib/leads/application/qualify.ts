import type { ActorContext } from "../domain/ports/shared";
import type { TransitionPayload } from "../domain/state-machine/types";
import { FollowUpType } from "../domain/enums";
import { qualifyLead as qualifyLeadBase } from "./commands";
import { createFollowUp, liveFollowUpDeps } from "./follow-up";
import {
  getLeadStateMachineMode,
  isLeadFollowUpEnabled,
  stateMachinePersistsSideEffects,
} from "./feature-flag";

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
  const result = await qualifyLeadBase(leadId, actor, event, payload);
  if (
    event === "disposition_callback" &&
    payload.dueAt &&
    isLeadFollowUpEnabled() &&
    !stateMachinePersistsSideEffects(getLeadStateMachineMode())
  ) {
    await createFollowUp(
      {
        leadId,
        ownerUserId: actor.userId,
        actor,
        type: FollowUpType.CALLBACK,
        dueAt: payload.dueAt,
        reason: payload.reason ?? payload.notes ?? null,
      },
      await liveFollowUpDeps(),
    );
  }
  return result;
}
