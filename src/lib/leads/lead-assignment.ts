import { LeadStatus, LeadTier, UserRole } from "@prisma/client";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { applyAuthorizedLeadStatus } from "@/lib/leads/adapters/prisma-lead-repository";
import {
  getLeadStateMachineMode,
  stateMachinePersistsSideEffects,
} from "@/lib/leads/application/feature-flag";

function maxQueue(): number {
  const n = Number(process.env.LEADS_MAX_QUEUE_PER_TELECALLER ?? "20");
  return Number.isFinite(n) && n > 0 ? n : 20;
}

function autoAssignEnabled(): boolean {
  return process.env.LEADS_AUTO_ASSIGN_ENABLED !== "false";
}

const OPEN_STATUSES: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.ASSIGNED,
  LeadStatus.CONTACTED_CALLBACK_REQUESTED,
  LeadStatus.NOT_REACHABLE,
  LeadStatus.COUNSELLING_BOOKED,
];

/**
 * Round-robin assign to on-shift telecallers under capacity.
 * Prefers telecaller with fewest open leads.
 */
export async function assignLead(
  leadId: string,
  actorId?: string | null,
  forceUserId?: string,
): Promise<string | null> {
  if (forceUserId) {
    if (stateMachinePersistsSideEffects(getLeadStateMachineMode())) {
      const { assignLeadToUser, reassignLeadToUser } = await import(
        "@/lib/leads/application/commands"
      );
      const actor = { userId: actorId ?? forceUserId, roles: ["OPS_MANAGER"] };
      const existing = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true } });
      if (existing?.status === LeadStatus.ASSIGNED) {
        await reassignLeadToUser(leadId, actor, forceUserId, "manual reassign");
      } else {
        await assignLeadToUser(leadId, actor, forceUserId);
      }
    } else {
      await applyAuthorizedLeadStatus(leadId, LeadStatus.ASSIGNED, {
        assignedTelecallerId: forceUserId,
        assignedAt: new Date(),
        lastActivityAt: new Date(),
      });
    }
    await audit.log({
      actorUserId: actorId ?? forceUserId,
      action: "lead.assign",
      entityType: "Lead",
      entityId: leadId,
      afterJson: { assignedTelecallerId: forceUserId, forced: true },
    });
    return forceUserId;
  }

  if (!autoAssignEnabled()) return null;

  const telecallers = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: UserRole.TELECALLER } },
    },
    select: { id: true },
  });
  if (telecallers.length === 0) return null;

  const cap = maxQueue();
  const depths = await Promise.all(
    telecallers.map(async (t) => {
      const open = await prisma.lead.count({
        where: {
          assignedTelecallerId: t.id,
          status: { in: OPEN_STATUSES },
        },
      });
      return { id: t.id, open };
    }),
  );

  const eligible = depths
    .filter((d) => d.open < cap)
    .sort((a, b) => a.open - b.open);
  if (eligible.length === 0) return null;

  const chosen = eligible[0].id;
  if (stateMachinePersistsSideEffects(getLeadStateMachineMode())) {
    const { assignLeadToUser } = await import("@/lib/leads/application/commands");
    await assignLeadToUser(
      leadId,
      { userId: actorId ?? chosen, roles: ["SYSTEM", "OPS_MANAGER"] },
      chosen,
    );
  } else {
    await applyAuthorizedLeadStatus(leadId, LeadStatus.ASSIGNED, {
      assignedTelecallerId: chosen,
      assignedAt: new Date(),
      lastActivityAt: new Date(),
    });
  }

  await audit.log({
    actorUserId: actorId ?? null,
    action: "lead.assign",
    entityType: "Lead",
    entityId: leadId,
    afterJson: { assignedTelecallerId: chosen, queueDepth: eligible[0].open },
  });

  return chosen;
}

export async function scheduleLeadSlaForTier(
  leadId: string,
  tier: LeadTier,
  startAt: Date,
): Promise<void> {
  const { leadSlaKeyForTier, SLA_DEFINITIONS } = await import(
    "@/lib/sla/definitions"
  );
  const { scheduleSla } = await import("@/lib/sla/engine");
  const key = leadSlaKeyForTier(tier);
  const def = SLA_DEFINITIONS[key];
  if (!def) return;
  await scheduleSla(leadId, def.entityType, def.stageKey, startAt, def);

  // Also stamp due dates on Lead for UI
  const responseDue = new Date(startAt);
  responseDue.setUTCHours(responseDue.getUTCHours() + def.responseHours);
  const qualifyDue =
    def.completeHours != null
      ? new Date(startAt.getTime() + def.completeHours * 3600_000)
      : null;
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      slaResponseDueAt: responseDue,
      slaQualifyDueAt: qualifyDue,
    },
  });
}
