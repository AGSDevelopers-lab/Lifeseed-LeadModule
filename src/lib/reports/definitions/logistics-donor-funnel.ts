import "server-only";

import { LeadStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { ReportDefinition, ReportFilters } from "@/lib/reports/types";

type Stage = {
  key: string;
  label: string;
  statuses?: LeadStatus[];
  donorPhase?: "P0_INTAKE" | "P1_SCREENING" | "P2_ACTIVE";
};

const STAGES: Stage[] = [
  {
    key: "captured",
    label: "Lead Captured",
    statuses: undefined, // all non-purged
  },
  {
    key: "contacted",
    label: "Contacted",
    statuses: [
      LeadStatus.CONTACTED_QUALIFIED,
      LeadStatus.CONTACTED_NOT_INTERESTED,
      LeadStatus.CONTACTED_CALLBACK_REQUESTED,
      LeadStatus.COUNSELLING_BOOKED,
      LeadStatus.COUNSELLING_ATTENDED,
      LeadStatus.COUNSELLING_NO_SHOW,
      LeadStatus.CONVERTED,
    ],
  },
  {
    key: "qualified",
    label: "Qualified",
    statuses: [
      LeadStatus.CONTACTED_QUALIFIED,
      LeadStatus.COUNSELLING_BOOKED,
      LeadStatus.COUNSELLING_ATTENDED,
      LeadStatus.CONVERTED,
    ],
  },
  {
    key: "counselled",
    label: "Counselled",
    statuses: [
      LeadStatus.COUNSELLING_ATTENDED,
      LeadStatus.CONVERTED,
    ],
  },
  {
    key: "converted",
    label: "Converted (Donor)",
    statuses: [LeadStatus.CONVERTED],
  },
  { key: "p0", label: "Donor P0", donorPhase: "P0_INTAKE" },
  { key: "p1", label: "Donor P1", donorPhase: "P1_SCREENING" },
  { key: "p2", label: "Donor P2", donorPhase: "P2_ACTIVE" },
];

function parseDateRange(filters: ReportFilters): { from: Date; to: Date } {
  const to = filters.toDate ? new Date(String(filters.toDate)) : new Date();
  const from = filters.fromDate
    ? new Date(String(filters.fromDate))
    : new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
  return { from, to };
}

export const donorFunnelReport: ReportDefinition = {
  id: "logistics.donor_funnel",
  name: "Donor Registration Funnel",
  category: "LOGISTICS",
  description:
    "Funnel Lead → Contacted → Qualified → Counselled → Converted → P0/P1/P2 with drop-off.",
  emptyStateHint:
    "No data yet — data will populate as leads are captured and donors advance",
  allowedRoles: [
    "BANK_SUPER_ADMIN",
    "BANK_BRM",
    "BANK_LOGISTICS",
    "OPS_MANAGER",
    "MARKETING_MANAGER",
  ],
  filters: [
    {
      key: "fromDate",
      label: "From date",
      description: "Lead capture / donor created window start",
      widget: "date-range",
    },
    {
      key: "toDate",
      label: "To date",
      description: "Window end",
      widget: "date-range",
    },
  ],
  columns: [
    { key: "stageName", label: "Stage Name", sortable: true },
    { key: "count", label: "Count", formatter: "number", numeric: true, higherIsBetter: true },
    { key: "conversionFromPrevPct", label: "Conversion % from previous", formatter: "percent", numeric: true, higherIsBetter: true },
    { key: "avgDaysInStage", label: "Avg days in stage", formatter: "number", numeric: true, higherIsBetter: false },
    { key: "topDropOffReason", label: "Top drop-off reason" },
  ],
  async query(filters) {
    const { from, to } = parseDateRange(filters);

    const [leads, donors, lost] = await Promise.all([
      prisma.lead.findMany({
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
      }),
      prisma.donor.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { phase: true, createdAt: true, updatedAt: true },
      }),
      prisma.lead.groupBy({
        by: ["lostReason"],
        where: {
          personType: "DONOR",
          capturedAt: { gte: from, lte: to },
          status: { in: [LeadStatus.LOST, LeadStatus.CONTACTED_NOT_INTERESTED] },
        },
        _count: { _all: true },
        orderBy: { _count: { lostReason: "desc" } },
        take: 1,
      }),
    ]);

    const topDrop =
      lost[0]?.lostReason ??
      (lost[0] ? "Not interested" : "—");

    let prevCount: number | null = null;
    return STAGES.map((stage) => {
      let count = 0;
      let avgDays = 0;

      if (stage.donorPhase) {
        const subset = donors.filter((d) => d.phase === stage.donorPhase);
        count = subset.length;
        avgDays =
          subset.length === 0
            ? 0
            : subset.reduce(
                (s, d) =>
                  s +
                  (d.updatedAt.getTime() - d.createdAt.getTime()) /
                    (24 * 60 * 60 * 1000),
                0,
              ) / subset.length;
      } else if (stage.statuses) {
        const subset = leads.filter((l) => stage.statuses!.includes(l.status));
        count = subset.length;
        avgDays =
          subset.length === 0
            ? 0
            : subset.reduce((s, l) => {
                const end = l.convertedAt ?? l.lastActivityAt;
                return (
                  s +
                  (end.getTime() - l.capturedAt.getTime()) /
                    (24 * 60 * 60 * 1000)
                );
              }, 0) / subset.length;
      } else {
        count = leads.length;
        avgDays = 0;
      }

      const conversionFromPrevPct =
        prevCount === null || prevCount === 0
          ? 100
          : Math.round((count / prevCount) * 1000) / 10;
      prevCount = count;

      return {
        stageName: stage.label,
        stageKey: stage.key,
        count,
        conversionFromPrevPct,
        avgDaysInStage: Math.round(avgDays * 10) / 10,
        topDropOffReason: topDrop,
      };
    });
  },
  exportFormats: ["CSV", "XLSX", "PDF"],
  scheduling: { allowedCadences: ["WEEKLY", "MONTHLY"] },
  caching: { ttlSeconds: 300, invalidateOn: ["lead.updated", "donor.created"] },
};
