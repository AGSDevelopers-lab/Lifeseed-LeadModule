import { LeadStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

/** Aggregate Lead reads for reports — stays inside adapters/prisma (P0-1). */
export async function scanDonorFunnelLeads(from: Date, to: Date) {
  return prisma.lead.findMany({
    where: {
      personType: "DONOR",
      capturedAt: { gte: from, lte: to },
      status: { not: LeadStatus.EXPIRED_AUTO_PURGED },
    },
    select: {
      status: true,
      lostReason: true,
      capturedAt: true,
      convertedAt: true,
      lastActivityAt: true,
    },
  });
}

export async function groupLostReasons(from: Date, to: Date) {
  return prisma.lead.groupBy({
    by: ["lostReason"],
    where: {
      personType: "DONOR",
      capturedAt: { gte: from, lte: to },
      status: { in: [LeadStatus.LOST, LeadStatus.CONTACTED_NOT_INTERESTED] },
    },
    _count: { _all: true },
    orderBy: { _count: { lostReason: "desc" } },
    take: 1,
  });
}

export async function countLeadsWhere(where: Prisma.LeadWhereInput): Promise<number> {
  return prisma.lead.count({ where });
}

export async function groupLeadsBySource(where?: Prisma.LeadWhereInput) {
  return prisma.lead.groupBy({
    by: ["source"],
    where,
    _count: { _all: true },
  });
}

export async function listExpiredLeadIds(where: Prisma.LeadWhereInput, take: number) {
  const rows = await prisma.lead.findMany({
    where,
    select: { id: true },
    take,
  });
  return rows.map((r) => r.id);
}

export async function countNoShowSessions(leadId: string): Promise<number> {
  return prisma.counsellingSession.count({
    where: { leadId, attendanceStatus: "NO_SHOW" },
  });
}

export async function listLeadIdsByStatus(status: LeadStatus, take: number): Promise<string[]> {
  const rows = await prisma.lead.findMany({
    where: { status },
    select: { id: true },
    take,
  });
  return rows.map((r) => r.id);
}
