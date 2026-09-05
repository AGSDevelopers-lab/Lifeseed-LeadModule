import { t01Intake } from "../domain/state-machine/transitions";
import { buildGuardFacts } from "./guard-facts";
import {
  getLeadStateMachineMode,
  stateMachinePersistsSideEffects,
} from "./feature-flag";
import { prismaTransitionStore } from "../adapters/prisma-transition-store";
import { prismaLeadRepository } from "../adapters/prisma-lead-repository";
import { auditPort } from "./audit-adapter";
import type { CreateLeadInput } from "../create-lead";
import { persistNewLead } from "../create-lead";
import { assignLead } from "../lead-assignment";

/**
 * T-01 orchestrator. When the state-machine flag is off, delegates to the
 * existing intake writer (status defaults to NEW on the Lead row).
 */
export async function intakeLead(input: CreateLeadInput) {
  const mode = getLeadStateMachineMode();
  const created = await persistNewLead(input);

  if (stateMachinePersistsSideEffects(mode)) {
    const actor = {
      userId: input.actorId ?? "SYSTEM",
      roles: ["SYSTEM"],
      siteId: null as string | null,
    };
    const domain = await prismaLeadRepository.byId(created.id);
    if (domain) {
      const ctxFacts = buildGuardFacts({
        lead: domain,
        actor,
        hasPermission: true,
        hasConsent: input.consentDataProcessing,
        publicIntake: true,
        requiredFieldsPresent: Boolean(input.fullName && input.phone),
        configVersionActive: true,
      });
      const result = t01Intake(null, {
        now: created.capturedAt,
        actor,
        payload: {
          score: created.score,
          scoreTier: created.tier,
          scoreBreakdown: (created.scoreBreakdown as Record<string, unknown> | null) ?? {},
          source: created.source,
        },
        facts: ctxFacts,
      });
      await prismaTransitionStore.persistBundle({
        lead: domain,
        nextStatus: result.nextStatus,
        writes: result.writes,
        actorUserId: actor.userId,
        actorRole: "SYSTEM",
        now: created.capturedAt,
      });
      await auditPort.append({
        actorUserId: input.actorId ?? null,
        action: "lead.intake",
        entityType: "Lead",
        entityId: created.id,
        after: { transitionId: "T-01" },
      });
    }
  }

  await assignLead(created.id, input.actorId, input.assignToUserId ?? undefined);
  const { prisma } = await import("@/lib/db");
  return prisma.lead.findUniqueOrThrow({ where: { id: created.id } });
}
