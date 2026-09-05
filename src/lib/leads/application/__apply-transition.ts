import type { ActorContext } from "../domain/ports/shared";
import type { Lead } from "../domain/entities/Lead";
import type { AuditPort } from "../domain/ports/AuditPort";
import type { ConversionPort } from "../domain/ports/ConversionPort";
import type { LeadRepository } from "../domain/ports/LeadRepository";
import type { SlaPort } from "../domain/ports/SlaPort";
import type { StateMachineEvent } from "../domain/state-machine/events";
import { transition } from "../domain/state-machine/transitions";
import type { DomainWrite, GuardFacts, TransitionContext, TransitionPayload, TransitionResult } from "../domain/state-machine/types";
import { LeadDomainError } from "../domain/errors";
import {
  getLeadStateMachineMode,
  stateMachinePersistsSideEffects,
} from "./feature-flag";

export type TransitionStore = {
  load(id: string, ctx?: ActorContext): Promise<Lead | null>;
  persistBundle(input: {
    lead: Lead;
    nextStatus: string;
    writes: DomainWrite[];
    actorUserId: string;
    actorRole: string | null;
    now: Date;
    throwAfterWrites?: boolean;
  }): Promise<{
    status: string;
    latestHistoryToStatus: string | null;
  }>;
};

export type ApplyTransitionDeps = {
  store: TransitionStore;
  audit: AuditPort;
  sla?: SlaPort;
  conversion?: ConversionPort;
  clock?: { now(): Date };
  repository?: LeadRepository;
};

export type ApplyTransitionInput = {
  leadId?: string | null;
  existingLead?: Lead | null;
  event: StateMachineEvent;
  actor: ActorContext;
  payload?: TransitionPayload;
  facts: GuardFacts;
  skipLoad?: boolean;
};

function logShadowDiscrepancy(
  leadId: string,
  expected: string,
  persisted: string,
): void {
  if (expected !== persisted) {
    console.warn(
      JSON.stringify({
        msg: "lead_state_machine_shadow_mismatch",
        leadId,
        expected,
        persisted,
      }),
    );
  }
}

export async function applyTransition(
  deps: ApplyTransitionDeps,
  input: ApplyTransitionInput,
): Promise<{ lead: Lead | null; result: TransitionResult }> {
  const mode = getLeadStateMachineMode();
  const now = deps.clock?.now() ?? new Date();
  const ctx: TransitionContext = {
    now,
    actor: {
      userId: input.actor.userId,
      roles: input.actor.roles,
      siteId: input.actor.siteId,
    },
    payload: input.payload ?? {},
    facts: input.facts,
  };

  let lead = input.existingLead ?? null;
  if (!lead && input.leadId && !input.skipLoad) {
    lead = await deps.store.load(input.leadId, input.actor);
  }

  const result = transition(lead, input.event, ctx);

  if (!stateMachinePersistsSideEffects(mode) && lead) {
    return { lead, result };
  }

  if (lead) {
    const persisted = await deps.store.persistBundle({
      lead,
      nextStatus: result.nextStatus,
      writes: result.writes,
      actorUserId: input.actor.userId,
      actorRole: input.actor.roles[0] ?? null,
      now,
    });
    if (mode === "shadow") {
      logShadowDiscrepancy(lead.id, result.nextStatus, persisted.status);
    }
    const updated = await deps.store.load(lead.id, input.actor);
    for (const entry of result.auditEntries) {
      await deps.audit.append({
        actorUserId: input.actor.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: lead.id,
        after: entry.after,
      });
    }
    return { lead: updated, result };
  }

  for (const entry of result.auditEntries) {
    await deps.audit.append({
      actorUserId: input.actor.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: input.leadId ?? "intake",
      after: entry.after,
    });
  }
  return { lead: null, result };
}

export function isLeadDomainError(err: unknown): err is LeadDomainError {
  return err instanceof LeadDomainError;
}
