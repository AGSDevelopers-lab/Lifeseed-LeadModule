import { LeadStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getConfigStoreAdapter } from "@/lib/leads/adapters/config-store-adapter";
import {
  countNoShowSessions,
  listExpiredLeadIds,
  listLeadIdsByStatus,
} from "@/lib/leads/adapters/prisma-lead-analytics";
import { resolveConfigPayload } from "@/lib/leads/application/config-store";
import { expireLeadV2 } from "@/lib/leads/application/commands";
import { applyLeadEvent } from "@/lib/leads/application/apply-lead-event";
import { DEFAULT_RETENTION_POLICY } from "@/lib/leads/config/defaults";
import { CONFIG_KEYS } from "@/lib/leads/config/keys";
import { getLeadConfigMode } from "@/lib/leads/config/flag";
import { LeadEvent } from "@/lib/leads/domain/enums";
import type { ActorContext } from "@/lib/leads/domain/ports/shared";
import { resolveSystemUserId } from "@/lib/leads/application/backfill-lead-conversions";

const MAX_NO_SHOW_ATTEMPTS = 3;

export async function systemLeadActor(): Promise<ActorContext> {
  const userId = await resolveSystemUserId(prisma);
  return {
    userId,
    roles: ["BANK_SUPER_ADMIN"],
    siteId: null,
  };
}

export async function tickCounsellingNoShows(limit = 200): Promise<{
  scanned: number;
  transitioned: number;
}> {
  const actor = await systemLeadActor();
  const ids = await listLeadIdsByStatus(actor, LeadStatus.COUNSELLING_NO_SHOW, limit);
  let transitioned = 0;
  for (const leadId of ids) {
    const attemptCount = await countNoShowSessions(leadId);
    if (attemptCount < MAX_NO_SHOW_ATTEMPTS) continue;
    await applyLeadEvent({
      leadId,
      event: LeadEvent.mark_lost,
      actor,
      permission: "lead.archive",
      payload: { reason: "exhausted_no_shows" },
      facts: {
        attemptCount,
        maxAttempts: MAX_NO_SHOW_ATTEMPTS,
        reasonPresent: true,
      },
      forcePersist: true,
    });
    transitioned += 1;
  }
  return { scanned: ids.length, transitioned };
}

export async function tickRetentionPurge(limit = 200): Promise<{ purged: number }> {
  const actor = await systemLeadActor();
  const now = new Date();
  const mode = getLeadConfigMode();
  const policy = await resolveConfigPayload(
    getConfigStoreAdapter(prisma),
    CONFIG_KEYS.RETENTION_POLICY_V1,
    DEFAULT_RETENTION_POLICY,
  );
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - policy.leadUnconvertedDays);
  const ids = await listExpiredLeadIds(
    actor,
    {
      statusNot: LeadStatus.EXPIRED_AUTO_PURGED,
      statusNotIn: [LeadStatus.CONVERTED],
      ...(mode === "off"
        ? { retentionExpiresAtTo: now }
        : { to: cutoff }),
    },
    limit,
  );
  let purged = 0;
  for (const leadId of ids) {
    await expireLeadV2(leadId, actor, { forcePersist: true });
    purged += 1;
  }
  return { purged };
}
