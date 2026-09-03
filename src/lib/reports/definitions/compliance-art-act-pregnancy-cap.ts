import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { ReportDefinition } from "@/lib/reports/types";

/**
 * ART Act §29 pregnancy cap tracking.
 * Uses Donor.cumulativePregnancies + Donor.bankPolicyCap.
 * TODO(reports §7.18): when DonationRecord gains explicit liveBirthDate /
 * pregnancyOutcome enums, replace lastLiveBirthAt approximation below —
 * do NOT alter existing tables in this sprint.
 */
export const artActPregnancyCapReport: ReportDefinition = {
  id: "compliance.art_act_pregnancy_cap",
  name: "ART Act §29 Pregnancy Cap Tracking",
  category: "COMPLIANCE",
  description:
    "Ensure no donor exceeds statutory / bank cumulative pregnancy caps.",
  emptyStateHint:
    "No data yet — data will populate as donation outcomes are reported",
  allowedRoles: [
    "BANK_SUPER_ADMIN",
    "BANK_COMPLIANCE",
    "BANK_QC_OFFICER",
    "BANK_CFO",
    "BANK_MEDICAL_DIRECTOR",
    "OPS_MANAGER",
  ],
  filters: [
    {
      key: "donorType",
      label: "Donor type",
      description: "Filter SEMEN / OOCYTE / ALL",
      widget: "single-select",
      options: [
        { value: "ALL", label: "All" },
        { value: "SEMEN", label: "Semen" },
        { value: "OOCYTE", label: "Oocyte" },
      ],
      defaultValue: "ALL",
    },
    {
      key: "riskOnly",
      label: "Risk only",
      description: "Show donors at ≥80% of cap",
      widget: "single-select",
      options: [
        { value: "false", label: "All donors" },
        { value: "true", label: "Near / at cap only" },
      ],
      defaultValue: "false",
    },
  ],
  columns: [
    { key: "donorCode", label: "Donor Code", sortable: true },
    { key: "type", label: "Type", formatter: "badge" },
    { key: "cumulativePregnancies", label: "Cumulative Pregnancies", formatter: "number", numeric: true, higherIsBetter: false, sortable: true },
    { key: "bankPolicyCap", label: "Bank Policy Cap", formatter: "number", numeric: true },
    { key: "pctOfCap", label: "% of Cap Reached", formatter: "percent", numeric: true, higherIsBetter: false, sortable: true },
    { key: "riskStatus", label: "Risk Status", formatter: "badge", sortable: true },
    { key: "lastLiveBirthAt", label: "Last Live Birth Date", formatter: "date" },
    { key: "donorId", label: "Donor ID" },
  ],
  async query(filters, scope) {
    const where: Prisma.DonorWhereInput = {
      status: { in: ["ELIGIBLE", "ACTIVE", "RETIRED", "SUSPENDED"] },
      ...(scope.extraWhere as Prisma.DonorWhereInput | undefined),
    };
    if (filters.donorType && filters.donorType !== "ALL") {
      where.type = String(filters.donorType) as "SEMEN" | "OOCYTE";
    }

    const donors = await prisma.donor.findMany({
      where,
      include: {
        donations: {
          orderBy: { outcomeReportedAt: "desc" },
          take: 5,
        },
      },
      orderBy: { cumulativePregnancies: "desc" },
      take: Number(process.env.REPORTS_MAX_ROWS_PER_PAGE ?? 5000),
    });

    const riskOnly = String(filters.riskOnly ?? "false") === "true";

    return donors
      .map((d) => {
        const cap = d.bankPolicyCap ?? 5;
        const pct = cap > 0 ? (d.cumulativePregnancies / cap) * 100 : 0;
        let riskStatus: "OK" | "NEAR_CAP" | "AT_CAP" | "OVER_CAP" = "OK";
        if (d.cumulativePregnancies > cap) riskStatus = "OVER_CAP";
        else if (d.cumulativePregnancies >= cap) riskStatus = "AT_CAP";
        else if (pct >= 80) riskStatus = "NEAR_CAP";

        // Approximate last live birth from DonationRecord outcome fields
        const live = d.donations.find((r) => {
          const t = (r.outcomeType ?? "").toLowerCase();
          return t.includes("live") || t.includes("birth") || t.includes("pregnancy");
        });

        return {
          donorId: d.id,
          donorCode: d.donorCode,
          type: d.type,
          cumulativePregnancies: d.cumulativePregnancies,
          bankPolicyCap: cap,
          pctOfCap: Math.round(pct * 10) / 10,
          riskStatus,
          lastLiveBirthAt:
            live?.outcomeReportedAt?.toISOString() ??
            live?.createdAt.toISOString() ??
            null,
        };
      })
      .filter((r) =>
        riskOnly ? r.riskStatus !== "OK" : true,
      );
  },
  scopedByRole(role, user) {
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
  scheduling: { allowedCadences: ["WEEKLY", "MONTHLY", "QUARTERLY"] },
  caching: { ttlSeconds: 300, invalidateOn: ["donor.updated", "donation.reported"] },
};
