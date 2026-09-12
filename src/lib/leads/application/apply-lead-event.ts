import type { ActorContext } from "../domain/ports/shared";
import { LeadEvent } from "../domain/enums";
import { applyTransition } from "./__apply-transition";
import { auditPort } from "./audit-adapter";
import { prismaTransitionStore } from "../adapters/prisma-transition-store";
import { prismaLeadRepository } from "../adapters/prisma-lead-repository";
import { actorHasPerm, buildGuardFacts } from "./guard-facts";
import type { TransitionPayload } from "../domain/state-machine/types";

export async function applyLeadEvent(input: {
  leadId: string;
  event: (typeof LeadEvent)[keyof typeof LeadEvent];
  actor: ActorContext;
  permission: string;
  payload?: TransitionPayload;
  facts?: Record<string, unknown>;
  forcePersist?: boolean;
}) {
  const lead = await prismaLeadRepository.byId(input.leadId, input.actor);
  if (!lead) throw new Error("Lead not found");
  const hasPermission = await actorHasPerm(input.actor, input.permission);
  const facts = buildGuardFacts({
    lead,
    actor: input.actor,
    hasPermission,
    reasonPresent: Boolean(input.payload?.reason),
    dueAtPresent: Boolean(input.payload?.dueAt),
    callRecordAttached: Boolean(input.payload?.callStartedAt),
    bookingExists: true,
    bookingInFuture: true,
    sessionRecordAttached: true,
    counsellorAvailable: true,
    assigneeAvailable: Boolean(input.payload?.assigneeUserId),
    claimAllowed: true,
    ...(input.facts as object),
  });
  return applyTransition(
    { store: prismaTransitionStore, audit: auditPort },
    {
      leadId: input.leadId,
      existingLead: lead,
      event: input.event,
      actor: input.actor,
      payload: input.payload,
      facts,
      forcePersist: input.forcePersist,
    },
  );
}
