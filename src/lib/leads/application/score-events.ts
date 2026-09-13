import { DispatchStatus, LeadEventType } from "@prisma/client";

import { prisma } from "@/lib/db";

/**
 * Additive LeadScoreChanged outbox emission — not a state-machine transition.
 */
export async function emitLeadScoreChanged(input: {
  leadId: string;
  score: number;
  tier: string;
  previousScore: number | null;
  now?: Date;
}): Promise<string> {
  const now = input.now ?? new Date();
  const row = await prisma.leadOutboxEvent.create({
    data: {
      aggregateType: "Lead",
      aggregateId: input.leadId,
      eventType: LeadEventType.LeadScoreChanged,
      eventVersion: 1,
      payload: {
        score: input.score,
        tier: input.tier,
        previousScore: input.previousScore,
      },
      occurredAt: now,
      dispatchStatus: DispatchStatus.PENDING,
    },
  });
  return row.id;
}
