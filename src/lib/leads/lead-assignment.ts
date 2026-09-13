import { LeadStatus, LeadTier, UserRole } from "@prisma/client";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getConfigStoreAdapter } from "@/lib/leads/adapters/config-store-adapter";
import {
  applyAuthorizedLeadStatus,
  countAssignedOpenLeads,
  prismaLeadRepository,
} from "@/lib/leads/adapters/prisma-lead-repository";
import { lookupUserSiteAndActive } from "@/lib/leads/adapters/prisma-assignment-directory";
import { resolveConfigPayload } from "@/lib/leads/application/config-store";
import { pickV2Assignee } from "@/lib/leads/application/assignment-eligibility";
import { assertSrTelecallerOwnPool } from "@/lib/leads/application/assignment-policy";
import {
  getLeadStateMachineMode,
  isLeadAssignmentV2Enabled,
  stateMachinePersistsSideEffects,
} from "@/lib/leads/application/feature-flag";
import { DEFAULT_ASSIGNMENT_RULES } from "@/lib/leads/config/defaults";
import { CONFIG_KEYS } from "@/lib/leads/config/keys";
import type { ActorContext } from "@/lib/leads/domain/ports/shared";

async function assignmentRules() {
  const envCap = Number(process.env.LEADS_MAX_QUEUE_PER_TELECALLER ?? "20");
  const fallback = {
    ...DEFAULT_ASSIGNMENT_RULES,
    maxQueuePerTelecaller:
      Number.isFinite(envCap) && envCap > 0
        ? envCap
        : DEFAULT_ASSIGNMENT_RULES.maxQueuePerTelecaller,
    autoAssignEnabled: process.env.LEADS_AUTO_ASSIGN_ENABLED !== "false",
  };
  return resolveConfigPayload(
    getConfigStoreAdapter(prisma),
    CONFIG_KEYS.ASSIGNMENT_RULES_V1,
    fallback,
  );
}

/**
 * Round-robin assign to on-shift telecallers under capacity.
 * Prefers telecaller with fewest open leads.
 */
export async function assignLead(
  leadId: string,
  actorId?: string | null,
  forceUserId?: string,
  actorCtx?: Pick<ActorContext, "roles" | "siteId">,
): Promise<string | null> {
  if (forceUserId) {
    if (actorCtx?.roles?.length) {
      const target = await lookupUserSiteAndActive(forceUserId);
      assertSrTelecallerOwnPool(
        {
          userId: actorId ?? forceUserId,
          roles: actorCtx.roles,
          siteId: actorCtx.siteId,
        },
        target?.siteId ?? null,
      );
    }
    if (stateMachinePersistsSideEffects(getLeadStateMachineMode())) {
      const { assignLeadToUser, reassignLeadToUser } = await import(
        "@/lib/leads/application/commands"
      );
      const actor = {
        userId: actorId ?? forceUserId,
        roles: actorCtx?.roles?.length ? [...actorCtx.roles] : ["OPS_MANAGER"],
        siteId: actorCtx?.siteId,
      };
      const existing = await prismaLeadRepository.byId(leadId, actor);
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

  if (isLeadAssignmentV2Enabled()) {
    const actor: ActorContext = {
      userId: actorId ?? "system",
      roles: ["SYSTEM", "OPS_MANAGER"],
      siteId: actorCtx?.siteId,
    };
    const existing = await prismaLeadRepository.byId(leadId, actor);
    const chosen = await pickV2Assignee(existing?.props.ownership.siteId ?? null, actor);
    if (!chosen) return null;
    if (stateMachinePersistsSideEffects(getLeadStateMachineMode())) {
      const { assignLeadToUser } = await import("@/lib/leads/application/commands");
      await assignLeadToUser(leadId, actor, chosen);
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
      afterJson: { assignedTelecallerId: chosen, path: "assignment_v2" },
    });
    return chosen;
  }

  const rules = await assignmentRules();
  if (!rules.autoAssignEnabled) return null;

  const telecallers = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: UserRole.TELECALLER } },
    },
    select: { id: true },
  });
  if (telecallers.length === 0) return null;

  const cap = rules.maxQueuePerTelecaller;
  const openStatuses = rules.openStatuses as LeadStatus[];
  const depths = await Promise.all(
    telecallers.map(async (t) => {
      const open = await countAssignedOpenLeads(t.id, openStatuses);
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
