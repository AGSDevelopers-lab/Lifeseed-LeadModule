import type { ActorContext } from "../domain/ports/shared";
import { convertDonorStub, convertRecipientStub } from "./commands";
import {
  convertLeadToDonor,
  convertLeadToRecipient,
  type DonorConvertExtras,
  type RecipientConvertInput,
} from "../lead-conversion";
import { getLeadStateMachineMode, stateMachinePersistsSideEffects } from "./feature-flag";

/** B04 stub: state-machine T-16/T-22 + existing ConversionPort-equivalent HIS writers. */
export async function convertDonor(
  leadId: string,
  actor: ActorContext,
  extras: DonorConvertExtras,
) {
  const mode = getLeadStateMachineMode();
  const result = await convertLeadToDonor(leadId, actor.userId, extras, {
    skipStatusWrite: stateMachinePersistsSideEffects(mode),
  });
  if (result.ok && stateMachinePersistsSideEffects(mode)) {
    await convertDonorStub(leadId, actor);
  }
  return result;
}

export async function convertRecipient(
  leadId: string,
  actor: ActorContext,
  input: RecipientConvertInput,
) {
  const mode = getLeadStateMachineMode();
  const result = await convertLeadToRecipient(leadId, actor.userId, input, {
    skipStatusWrite: stateMachinePersistsSideEffects(mode),
  });
  if (result.ok && stateMachinePersistsSideEffects(mode)) {
    await convertRecipientStub(leadId, actor);
  }
  return result;
}
