import { FollowUpStatus } from "@prisma/client";

import { FollowUpDockClient } from "@/app/(portals)/telecaller/leads/[id]/follow-up-dock-client";
import type { FollowUpQueueRow } from "@/app/(portals)/telecaller/follow-ups/follow-up-queue-client";
import { prisma } from "@/lib/db";
import { isLeadFollowUpEnabled } from "@/lib/leads/application/feature-flag";

export async function FollowUpDock({
  leadId,
  enabled,
}: {
  leadId: string;
  enabled: boolean;
}) {
  if (!enabled || !isLeadFollowUpEnabled()) return null;
  const rows = await prisma.leadFollowUp.findMany({
    where: {
      leadId,
      status: {
        in: [FollowUpStatus.OPEN, FollowUpStatus.DUE, FollowUpStatus.OVERDUE],
      },
    },
    include: { lead: { select: { leadCode: true } } },
    orderBy: { dueAt: "asc" },
    take: 20,
  });
  const items: FollowUpQueueRow[] = rows.map((r) => ({
    id: r.id,
    leadId: r.leadId,
    leadCode: r.lead.leadCode,
    type: r.type,
    priority: r.priority,
    reason: r.reason,
    dueAt: r.dueAt.toISOString(),
    status: r.status,
  }));
  return <FollowUpDockClient leadId={leadId} items={items} />;
}
