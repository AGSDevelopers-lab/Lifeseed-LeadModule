/**
 * Backward-compatible shim: embryology outcome nudges also register on the
 * generic SLA engine while keeping OutcomeNudge rows as the delivery queue.
 */
import { SlaEntityType } from "@prisma/client";

import { scheduleSla } from "@/lib/sla/engine";

const OFFSET_STAGE: Record<number, string> = {
  14: "embryology_outcome_14d",
  30: "embryology_outcome_30d",
  90: "embryology_outcome_90d",
  180: "embryology_outcome_180d",
};

export async function scheduleEmbryologyOutcomeSlas(
  drfId: string,
  transferredAt: Date,
): Promise<void> {
  for (const [offset, stageKey] of Object.entries(OFFSET_STAGE)) {
    const start = new Date(transferredAt);
    // SLA window starts at transfer; responseHours in definition = day offset
    await scheduleSla(
      drfId,
      SlaEntityType.EMBRYOLOGY_OUTCOME,
      stageKey,
      start,
    ).catch(() => undefined);
    void offset;
  }
}
