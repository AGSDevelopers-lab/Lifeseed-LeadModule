import { prisma } from "@/lib/db";
import { actorHasPerm, buildGuardFacts } from "./guard-facts";
import {
  t16ConvertDonor,
  t19SessionCancelled,
  t22ConvertRecipient,
  t27Archive,
} from "../domain/state-machine/transitions";
import type { Lead } from "../domain/entities/Lead";
import type { ActorContext } from "../domain/ports/shared";
import type { TransitionContext, TransitionFn } from "../domain/state-machine/types";
import { ARCHIVE_LEAD_PERMISSION, CONVERT_LEAD_PERMISSION } from "./commands";
import {
  COUNSELLING_CANCEL_PERMISSION,
  COUNSELLING_RESCHEDULE_PERMISSION,
} from "./counselling-permissions";

export const LEAD_360_ACTION_IDS = [
  "ARCHIVE_LEAD",
  "RESCHEDULE_COUNSELLING",
  "CANCEL_COUNSELLING",
  "CONVERT_TO_DONOR",
  "CONVERT_TO_RECIPIENT",
] as const;

export type Lead360ActionId = (typeof LEAD_360_ACTION_IDS)[number];

export type ResolvedLeadAction = {
  id: Lead360ActionId;
  available: true;
};

function asTransitionActor(actor: ActorContext) {
  return { userId: actor.userId, roles: actor.roles, siteId: actor.siteId };
}

async function advisoryAllowed(
  fn: TransitionFn,
  lead: Lead,
  actor: ActorContext,
  permission: string,
  extra: {
    payload?: TransitionContext["payload"];
    facts?: Parameters<typeof buildGuardFacts>[0];
  } = {},
): Promise<boolean> {
  const hasPermission = await actorHasPerm(actor, permission);
  if (!hasPermission) return false;
  const facts = buildGuardFacts({
    lead,
    actor,
    hasPermission,
    reasonPresent: true,
    ...extra.facts,
  });
  try {
    fn(lead, {
      now: new Date(),
      actor: asTransitionActor(actor),
      payload: extra.payload ?? { reason: "advisory" },
      facts,
    });
    return true;
  } catch {
    return false;
  }
}

async function loadOpenBooking(leadId: string) {
  return prisma.counsellingBooking.findFirst({
    where: { leadId, bookingStatus: "SCHEDULED" },
    orderBy: { scheduledAt: "desc" },
  });
}

/**
 * Advisory-only. Mutations must re-check via their own commands.
 * Closed catalogue of five action IDs — never a sixth.
 */
export async function resolveLeadActions(
  lead: Lead,
  actor: ActorContext,
): Promise<ResolvedLeadAction[]> {
  const booking = await loadOpenBooking(lead.id);
  const bookingInFuture = Boolean(booking && booking.scheduledAt.getTime() > Date.now());

  const checks: Array<{
    id: Lead360ActionId;
    ok: Promise<boolean>;
  }> = [
    {
      id: "ARCHIVE_LEAD",
      ok: advisoryAllowed(t27Archive, lead, actor, ARCHIVE_LEAD_PERMISSION),
    },
    {
      id: "RESCHEDULE_COUNSELLING",
      ok: advisoryAllowed(t19SessionCancelled, lead, actor, COUNSELLING_RESCHEDULE_PERMISSION, {
        payload: { cancelMode: "reschedule", reason: "advisory" },
        facts: { bookingExists: Boolean(booking), bookingInFuture },
      }),
    },
    {
      id: "CANCEL_COUNSELLING",
      ok: advisoryAllowed(t19SessionCancelled, lead, actor, COUNSELLING_CANCEL_PERMISSION, {
        payload: { cancelMode: "full", reason: "advisory" },
        facts: { bookingExists: Boolean(booking), bookingInFuture },
      }),
    },
    {
      id: "CONVERT_TO_DONOR",
      ok: advisoryAllowed(t16ConvertDonor, lead, actor, CONVERT_LEAD_PERMISSION, {
        facts: { requiredFieldsPresent: true, hasConversion: false },
      }),
    },
    {
      id: "CONVERT_TO_RECIPIENT",
      ok: advisoryAllowed(t22ConvertRecipient, lead, actor, CONVERT_LEAD_PERMISSION, {
        facts: { recommendationRegister: true, hasConversion: false },
      }),
    },
  ];

  const out: ResolvedLeadAction[] = [];
  for (const check of checks) {
    if (await check.ok) out.push({ id: check.id, available: true });
  }
  return out;
}
