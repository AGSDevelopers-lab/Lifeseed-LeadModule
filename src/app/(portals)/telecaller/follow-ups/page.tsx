import { redirect } from "next/navigation";
import { FollowUpStatus } from "@prisma/client";

import {
  FollowUpQueueClient,
  type FollowUpQueueRow,
} from "@/app/(portals)/telecaller/follow-ups/follow-up-queue-client";
import { prisma } from "@/lib/db";
import { isLeadFollowUpEnabled } from "@/lib/leads/application/feature-flag";
import { canOverrideFollowUp } from "@/lib/leads/application/follow-up";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export default async function TelecallerFollowUpQueuePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "follow_up.list")) {
    redirect("/telecaller/dashboard");
  }
  if (!isLeadFollowUpEnabled()) {
    redirect("/telecaller/dashboard");
  }

  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const tomorrow = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekEnd = new Date(todayStart.getTime() + 8 * 24 * 60 * 60 * 1000);
  const ownerFilter = canOverrideFollowUp(session.roles)
    ? {}
    : { ownerUserId: session.userId };

  const rows = await prisma.leadFollowUp.findMany({
    where: {
      ...ownerFilter,
      status: {
        in: [FollowUpStatus.OPEN, FollowUpStatus.DUE, FollowUpStatus.OVERDUE],
      },
    },
    include: { lead: { select: { leadCode: true } } },
    orderBy: [{ dueAt: "asc" }],
    take: 200,
  });

  const toRow = (r: (typeof rows)[number]): FollowUpQueueRow => ({
    id: r.id,
    leadId: r.leadId,
    leadCode: r.lead.leadCode,
    type: r.type,
    priority: r.priority,
    reason: r.reason,
    dueAt: r.dueAt.toISOString(),
    status: r.status,
  });

  const overdue = rows.filter((r) => r.status === FollowUpStatus.OVERDUE || r.dueAt < todayStart);
  const dueToday = rows.filter(
    (r) =>
      r.status !== FollowUpStatus.OVERDUE &&
      r.dueAt >= todayStart &&
      r.dueAt < tomorrow,
  );
  const next7 = rows.filter((r) => r.dueAt >= tomorrow && r.dueAt < weekEnd);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Follow-up queue</h1>
        <p className="text-sm text-stone-600">
          Due today, overdue, and the next 7 days — complete or reschedule without leaving the queue.
        </p>
      </div>
      <FollowUpQueueClient
        overdue={overdue.map(toRow)}
        dueToday={dueToday.map(toRow)}
        next7={next7.map(toRow)}
      />
    </div>
  );
}
