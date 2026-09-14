import { prisma } from "@/lib/db";
import { bucketSlaBreachRateByWeek } from "@/lib/leads/application/sla-buckets";

const LEAD_SLA_ENTITY = "LEAD_RESPONSE" as const;

export async function listLeadSlaBreaches(take = 200) {
  return prisma.slaSchedule.findMany({
    where: { status: "BREACHED", entityType: LEAD_SLA_ENTITY },
    orderBy: { responseDueAt: "asc" },
    take,
    select: {
      id: true,
      entityType: true,
      entityId: true,
      stageKey: true,
      responseDueAt: true,
      status: true,
    },
  });
}

export async function loadSlaBreachTrend(lookbackWeeks = 8, now = new Date()) {
  const from = new Date(now.getTime() - lookbackWeeks * 7 * 24 * 60 * 60 * 1000);
  const rows = await prisma.slaSchedule.findMany({
    where: {
      entityType: LEAD_SLA_ENTITY,
      OR: [{ createdAt: { gte: from } }, { responseDueAt: { gte: from } }],
    },
    select: { createdAt: true, responseDueAt: true, status: true },
  });
  return bucketSlaBreachRateByWeek(rows, lookbackWeeks, now);
}
