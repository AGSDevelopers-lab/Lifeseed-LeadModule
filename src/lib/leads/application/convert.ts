import { SlaEntityType, SlaStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { LeadDuplicateConversionError, LeadDomainError } from "../domain/errors";
import { LeadEvent, LeadEventType, LeadOutcome, LeadStatus } from "../domain/enums";
import type { ActorContext } from "../domain/ports/shared";
import type { ConversionPort } from "../domain/ports/ConversionPort";
import type { SlaPort } from "../domain/ports/SlaPort";
import { transition } from "../domain/state-machine/transitions";
import type { DomainWrite, GuardFacts, TransitionContext } from "../domain/state-machine/types";
import { hisConversionAdapter } from "../adapters/his-conversion-adapter";
import {
  LEAD_INTERACTIVE_TX_OPTIONS,
} from "../adapters/prisma-lead-repository";
import { prismaTransitionStore } from "../adapters/prisma-transition-store";
import { actorHasPerm, buildGuardFacts } from "./guard-facts";
import { auditPort } from "./audit-adapter";
import type { AuditPort } from "../domain/ports/AuditPort";
import { isLeadConversionPortEnabled } from "./feature-flag";
import { convertDonorStub, convertRecipientStub } from "./commands";
import type { DonorConvertExtras, RecipientConvertInput } from "../lead-conversion";
import type { TransitionStore } from "./__apply-transition";

export type ConvertResult =
  | { ok: true; donorId?: string; donorCode?: string; recipientId?: string; recipientCode?: string }
  | { ok: false; error: string; code?: string };

export type ConvertDeps = {
  conversion: ConversionPort;
  store: TransitionStore;
  sla: SlaPort;
  audit: AuditPort;
  flagEnabled: boolean;
  runInTransaction: <T>(fn: (unitOfWork: unknown) => Promise<T>) => Promise<T>;
  persistWithClient?: (
    unitOfWork: unknown,
    input: Parameters<TransitionStore["persistBundle"]>[0],
  ) => Promise<Awaited<ReturnType<TransitionStore["persistBundle"]>>>;
  conversionExists: (leadId: string) => Promise<boolean>;
};

const defaultSla: SlaPort = {
  async schedule() {
    return "noop";
  },
  async complete() {
    /* completed via tx.slaSchedule in convert */
  },
};

function defaultDeps(): ConvertDeps {
  return {
    conversion: hisConversionAdapter,
    store: prismaTransitionStore,
    sla: defaultSla,
    audit: auditPort,
    flagEnabled: isLeadConversionPortEnabled(),
    conversionExists: async (leadId) => {
      const row = await prisma.leadConversion.findUnique({ where: { leadId } });
      return Boolean(row);
    },
    persistWithClient: async (unitOfWork, input) =>
      prismaTransitionStore.persistBundleWithClient(unitOfWork as never, input),
    runInTransaction: (fn) => prisma.$transaction((tx) => fn(tx), LEAD_INTERACTIVE_TX_OPTIONS),
  };
}

function enrichWrites(
  writes: DomainWrite[],
  args: {
    target: "DONOR" | "RECIPIENT";
    targetEntityId: string;
    actorUserId: string;
    now: Date;
    eligibility: Record<string, unknown>;
  },
): DomainWrite[] {
  return writes.map((w) => {
    if (w.kind === "conversion_stub") {
      return {
        ...w,
        target: args.target,
        targetEntityId: args.targetEntityId,
        decidedByUserId: args.actorUserId,
        eligibilitySnapshot: args.eligibility,
      };
    }
    if (w.kind === "lead_patch") {
      return {
        ...w,
        patch: {
          ...w.patch,
          outcome: LeadOutcome.WON,
          convertedAt: args.now,
          convertedByUserId: args.actorUserId,
          convertedDonorId: args.target === "DONOR" ? args.targetEntityId : w.patch.convertedDonorId,
          convertedRecipientId:
            args.target === "RECIPIENT" ? args.targetEntityId : w.patch.convertedRecipientId,
          lastActivityAt: args.now,
        },
      };
    }
    if (w.kind === "outbox" && w.eventType === LeadEventType.LeadConverted) {
      return {
        ...w,
        payload: { ...w.payload, target: args.target, targetEntityId: args.targetEntityId },
      };
    }
    return w;
  });
}

async function completeQualificationSla(unitOfWork: unknown, leadId: string, now: Date) {
  const tx = unitOfWork as {
    slaSchedule?: {
      updateMany: (args: unknown) => Promise<unknown>;
    };
  };
  if (tx.slaSchedule) {
    await tx.slaSchedule.updateMany({
      where: {
        entityType: SlaEntityType.LEAD_QUALIFICATION,
        entityId: leadId,
        status: { not: SlaStatus.COMPLETED },
      },
      data: { completedAt: now, status: SlaStatus.COMPLETED, respondedAt: now },
    });
  }
}

async function convertViaPort(
  kind: "DONOR" | "RECIPIENT",
  leadId: string,
  actor: ActorContext,
  extras: Record<string, unknown>,
  deps: ConvertDeps,
): Promise<ConvertResult> {
  const lead = await deps.store.load(leadId, actor);
  if (!lead) return { ok: false, error: "Lead not found" };

  const eligibility =
    kind === "DONOR"
      ? await deps.conversion.isEligibleForDonor(leadId, actor)
      : await deps.conversion.isEligibleForRecipient(leadId, actor);
  if (!eligibility.eligible) {
    return { ok: false, error: eligibility.reasons.join("; ") || "Not eligible", code: "NOT_ELIGIBLE" };
  }

  if (await deps.conversionExists(leadId)) {
    throw new LeadDuplicateConversionError("Lead already converted", {
      leadId,
      code: "DUPLICATE_CONVERSION",
    });
  }

  const hasPermission = await actorHasPerm(actor, "lead.convert");
  const facts: GuardFacts = buildGuardFacts({
    lead,
    actor,
    hasPermission,
    requiredFieldsPresent: true,
    hasConversion: false,
    dncBlocked: false,
    recommendationRegister: kind === "RECIPIENT",
  });
  const now = new Date();
  const ctx: TransitionContext = {
    now,
    actor: { userId: actor.userId, roles: actor.roles, siteId: actor.siteId },
    payload: {},
    facts,
  };
  const event = kind === "DONOR" ? LeadEvent.convert_donor : LeadEvent.convert_recipient;
  const result = transition(lead, event, ctx);

  return deps.runInTransaction(async (unitOfWork) => {
    const created =
      kind === "DONOR"
        ? await deps.conversion.convertToDonor(
            { leadId, actorUserId: actor.userId, extras, unitOfWork },
            actor,
          )
        : await deps.conversion.convertToRecipient(
            { leadId, actorUserId: actor.userId, extras, unitOfWork },
            actor,
          );
    if (!created.ok) {
      throw new LeadDomainError("CONVERSION_DOWNSTREAM_FAILED", created.error, { leadId });
    }
    const targetEntityId = created.targetEntityId;
    const writes = enrichWrites(result.writes, {
      target: kind,
      targetEntityId,
      actorUserId: actor.userId,
      now,
      eligibility: { ...eligibility },
    });
    const persistInput = {
      lead,
      nextStatus: result.nextStatus,
      writes,
      actorUserId: actor.userId,
      actorRole: actor.roles[0] ?? null,
      now,
    };
    if (deps.persistWithClient) {
      await deps.persistWithClient(unitOfWork, persistInput);
    } else {
      await deps.store.persistBundle(persistInput);
    }
    await completeQualificationSla(unitOfWork, leadId, now);
    await deps.sla.complete("LEAD_QUALIFICATION", leadId);
    for (const entry of result.auditEntries) {
      await deps.audit.append({
        actorUserId: actor.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: leadId,
        after: { ...entry.after, targetEntityId, status: LeadStatus.CONVERTED },
      });
    }
    if (kind === "DONOR") {
      return {
        ok: true as const,
        donorId: created.donorId ?? targetEntityId,
        donorCode: created.donorCode,
      };
    }
    return {
      ok: true as const,
      recipientId: created.recipientId ?? targetEntityId,
      recipientCode: created.recipientCode,
    };
  });
}

/** T-16 convert_donor */
export async function convertDonor(
  leadId: string,
  actor: ActorContext,
  extras: DonorConvertExtras,
  deps: ConvertDeps = defaultDeps(),
): Promise<ConvertResult> {
  if (!deps.flagEnabled) {
    const { convertLeadToDonor } = await import("../lead-conversion");
    const result = await convertLeadToDonor(leadId, actor.userId, extras, {
      skipStatusWrite: true,
    }, actor);
    if (result.ok) {
      await convertDonorStub(leadId, actor);
    }
    return result.ok ? { ok: true, donorId: result.donorId } : result;
  }
  try {
    return await convertViaPort("DONOR", leadId, actor, extras as unknown as Record<string, unknown>, deps);
  } catch (err) {
    if (err instanceof LeadDuplicateConversionError) {
      return { ok: false, error: err.message, code: "DUPLICATE_CONVERSION" };
    }
    if (err instanceof LeadDomainError) {
      return { ok: false, error: err.message, code: err.code };
    }
    throw err;
  }
}

/** T-22 convert_recipient */
export async function convertRecipient(
  leadId: string,
  actor: ActorContext,
  input: RecipientConvertInput,
  deps: ConvertDeps = defaultDeps(),
): Promise<ConvertResult> {
  if (!deps.flagEnabled) {
    const { convertLeadToRecipient } = await import("../lead-conversion");
    const result = await convertLeadToRecipient(leadId, actor.userId, input, {
      skipStatusWrite: true,
    }, actor);
    if (result.ok) {
      await convertRecipientStub(leadId, actor);
    }
    return result.ok ? { ok: true, recipientId: result.recipientId } : result;
  }
  try {
    return await convertViaPort(
      "RECIPIENT",
      leadId,
      actor,
      input as unknown as Record<string, unknown>,
      deps,
    );
  } catch (err) {
    if (err instanceof LeadDuplicateConversionError) {
      return { ok: false, error: err.message, code: "DUPLICATE_CONVERSION" };
    }
    if (err instanceof LeadDomainError) {
      return { ok: false, error: err.message, code: err.code };
    }
    throw err;
  }
}

export async function getConversionEligibility(leadId: string) {
  const conversion = hisConversionAdapter;
  const [donor, recipient] = await Promise.all([
    conversion.isEligibleForDonor(leadId),
    conversion.isEligibleForRecipient(leadId),
  ]);
  return { donor, recipient };
}
