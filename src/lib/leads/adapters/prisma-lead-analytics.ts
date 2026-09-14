import { LeadStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { ActorContext } from "../domain/ports/shared";
import type { LeadListFilters } from "../domain/ports/LeadRepository";
import { computeMonthlyConversionCohorts } from "../application/lead-cohort";
import { leadListScopeWhere, mergeLeadListFilters } from "./lead-access-scope";
import { prismaLeadRepository } from "./prisma-lead-repository";

function scopedWhere(actor: ActorContext, filters?: LeadListFilters): Prisma.LeadWhereInput {
  return mergeLeadListFilters(leadListScopeWhere(actor), filters) as Prisma.LeadWhereInput;
}

/** Aggregate Lead reads — actor-scoped (CONFLICT-25). STOP-3 v1.4 / P0-1. */
export async function scanDonorFunnelLeads(actor: ActorContext, from: Date, to: Date) {
  return prisma.lead.findMany({
    where: scopedWhere(actor, {
      personType: "DONOR",
      from,
      to,
      statusNot: LeadStatus.EXPIRED_AUTO_PURGED,
    }),
    select: {
      status: true,
      lostReason: true,
      capturedAt: true,
      convertedAt: true,
      lastActivityAt: true,
    },
  });
}

export async function groupLostReasons(actor: ActorContext, from: Date, to: Date) {
  return prisma.lead.groupBy({
    by: ["lostReason"],
    where: scopedWhere(actor, {
      personType: "DONOR",
      from,
      to,
      statuses: [LeadStatus.LOST, LeadStatus.CONTACTED_NOT_INTERESTED],
    }),
    _count: { _all: true },
    orderBy: { _count: { lostReason: "desc" } },
    take: 1,
  });
}

export async function countLeadsWhere(
  actor: ActorContext,
  filters: LeadListFilters = {},
): Promise<number> {
  return prismaLeadRepository.count(actor, filters);
}

export async function groupLeadsBySource(actor: ActorContext, filters?: LeadListFilters) {
  const rows = await prismaLeadRepository.groupBySource(actor, filters);
  return rows.map((r) => ({ source: r.source, _count: { _all: r.count } }));
}

export async function groupLeadsByTier(actor: ActorContext, filters?: LeadListFilters) {
  const rows = await prismaLeadRepository.groupByTier(actor, filters);
  return rows.map((r) => ({ tier: r.tier, _count: { _all: r.count } }));
}

export async function groupLeadsByEntryCohort(actor: ActorContext, now = new Date()) {
  const rows = await prisma.lead.findMany({
    where: scopedWhere(actor),
    select: { createdAt: true, convertedAt: true, status: true, outcome: true },
  });
  return computeMonthlyConversionCohorts(rows, now);
}

export async function listExpiredLeadIds(
  actor: ActorContext,
  filters: LeadListFilters,
  take: number,
) {
  const rows = await prisma.lead.findMany({
    where: scopedWhere(actor, filters),
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

export async function listLeadIdsByStatus(
  actor: ActorContext,
  status: LeadStatus,
  take: number,
): Promise<string[]> {
  const rows = await prisma.lead.findMany({
    where: scopedWhere(actor, { status }),
    select: { id: true },
    take,
  });
  return rows.map((r) => r.id);
}
