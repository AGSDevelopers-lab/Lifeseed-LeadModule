import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { ReportDefinition, ReportFilters } from "@/lib/reports/types";

function parseDateRange(filters: ReportFilters): { from: Date; to: Date } {
  const to = filters.toDate
    ? new Date(String(filters.toDate))
    : new Date();
  const from = filters.fromDate
    ? new Date(String(filters.fromDate))
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

export const donorAcceptanceReport: ReportDefinition = {
  id: "clinical.donor_acceptance",
  name: "Donor Acceptance Report",
  category: "CLINICAL",
  description:
    "Donors who reached P2_ACTIVE in the period, with journey timing and SeedScore tier.",
  emptyStateHint:
    "No data yet — data will populate as donors advance to P2 Active",
  allowedRoles: [
    "BANK_SUPER_ADMIN",
    "BANK_MEDICAL_DIRECTOR",
    "BANK_LAB_HEAD",
    "BANK_BRM",
    "OPS_MANAGER",
  ],
  filters: [
    {
      key: "fromDate",
      label: "From date",
      description: "Start of P2 entry window (defaults last 30 days)",
      widget: "date-range",
    },
    {
      key: "toDate",
      label: "To date",
      description: "End of P2 entry window",
      widget: "date-range",
    },
    {
      key: "siteCode",
      label: "Site",
      description: "Filter by bank site code",
      widget: "single-select",
      options: [
        { value: "ALL", label: "All sites" },
        { value: "WB", label: "West Bengal" },
        { value: "TG", label: "Telangana" },
      ],
      defaultValue: "ALL",
    },
    {
      key: "donorType",
      label: "Donor type",
      description: "Semen, oocyte, or both",
      widget: "single-select",
      options: [
        { value: "ALL", label: "Both" },
        { value: "SEMEN", label: "Semen" },
        { value: "OOCYTE", label: "Oocyte" },
      ],
      defaultValue: "ALL",
    },
  ],
  columns: [
    { key: "donorCode", label: "Donor Code", description: "Donor.donorCode", sortable: true },
    { key: "fullName", label: "Full Name", description: "Donor.fullName" },
    { key: "type", label: "Type", formatter: "badge", sortable: true },
    { key: "siteCode", label: "Site", description: "Site.code" },
    { key: "p0EnteredAt", label: "P0 Entered At", formatter: "date", description: "Donor.createdAt" },
    { key: "p1EnteredAt", label: "P1 Entered At", formatter: "date", description: "AuditLog phase event" },
    { key: "p2EnteredAt", label: "P2 Entered At", formatter: "date", sortable: true },
    { key: "daysP0ToP2", label: "Days P0→P2", formatter: "number", numeric: true, higherIsBetter: false },
    { key: "currentTier", label: "Current Tier", formatter: "badge" },
    { key: "hasSourceLead", label: "Source Lead?", formatter: "boolean" },
    { key: "donorId", label: "Donor ID", formatter: "text" },
  ],
  async query(filters, scope) {
    const { from, to } = parseDateRange(filters);
    const where: Prisma.DonorWhereInput = {
      phase: "P2_ACTIVE",
      status: { in: ["ELIGIBLE", "ACTIVE"] },
      updatedAt: { gte: from, lte: to },
      ...(scope.extraWhere as Prisma.DonorWhereInput | undefined),
    };

    if (filters.siteCode && filters.siteCode !== "ALL") {
      where.site = { code: String(filters.siteCode) as "WB" | "TG" | "BD" };
    }
    if (filters.donorType && filters.donorType !== "ALL") {
      where.type = String(filters.donorType) as "SEMEN" | "OOCYTE";
    }

    const donors = await prisma.donor.findMany({
      where,
      include: { site: true },
      orderBy: { updatedAt: "desc" },
      take: Number(process.env.REPORTS_MAX_ROWS_PER_PAGE ?? 5000),
    });

    const donorIds = donors.map((d) => d.id);
    const phaseEvents = donorIds.length
      ? await prisma.auditLog.findMany({
          where: {
            donorRelId: { in: donorIds },
            OR: [
              { action: { contains: "P1" } },
              { action: { contains: "P2" } },
              { action: { contains: "phase" } },
            ],
          },
          orderBy: { timestamp: "asc" },
        })
      : [];

    const p1Map = new Map<string, Date>();
    const p2Map = new Map<string, Date>();
    for (const ev of phaseEvents) {
      if (!ev.donorRelId) continue;
      const a = ev.action.toLowerCase();
      if (a.includes("p1") && !p1Map.has(ev.donorRelId)) {
        p1Map.set(ev.donorRelId, ev.timestamp);
      }
      if (a.includes("p2")) {
        p2Map.set(ev.donorRelId, ev.timestamp);
      }
    }

    return donors.map((d) => {
      const p0 = d.createdAt;
      const p2 = p2Map.get(d.id) ?? d.updatedAt;
      const days = Math.max(
        0,
        Math.round((p2.getTime() - p0.getTime()) / (24 * 60 * 60 * 1000)),
      );
      return {
        donorId: d.id,
        donorCode: d.donorCode,
        fullName: d.fullName,
        type: d.type,
        siteCode: d.site.code,
        p0EnteredAt: p0.toISOString(),
        p1EnteredAt: p1Map.get(d.id)?.toISOString() ?? null,
        p2EnteredAt: p2.toISOString(),
        daysP0ToP2: days,
        currentTier: d.currentTier ?? "UNSCORED",
        hasSourceLead: Boolean(d.sourceLeadId),
        sourceLeadId: d.sourceLeadId,
      };
    });
  },
  scopedByRole(role, user) {
    if (role === "CLINIC_DOCTOR" || role === "CLINIC_COORDINATOR") {
      // Clinic users do not see bank-wide acceptance roster
      return { id: "__none__" };
    }
    if (user.siteId && role !== "BANK_SUPER_ADMIN" && role !== "OPS_MANAGER") {
      return { siteId: user.siteId };
    }
    return undefined;
  },
  drillDownTarget(row) {
    const id = row.donorId;
    return typeof id === "string" ? `/admin/donors/${id}` : null;
  },
  exportFormats: ["CSV", "XLSX", "PDF"],
  scheduling: { allowedCadences: ["DAILY", "WEEKLY", "MONTHLY"] },
  caching: { ttlSeconds: 300, invalidateOn: ["donor.phase.advance", "donor.created"] },
};
