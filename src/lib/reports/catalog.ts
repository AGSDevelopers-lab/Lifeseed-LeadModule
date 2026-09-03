/** Client-safe catalog for Cmd+K (no Prisma / server-only). */
export type ReportCatalogEntry = {
  id: string;
  name: string;
  category: string;
  description: string;
  href: string;
};

export const REPORT_CATALOG: ReportCatalogEntry[] = [
  {
    id: "clinical.donor_acceptance",
    name: "Donor Acceptance Report",
    category: "CLINICAL",
    description: "Donors who reached P2_ACTIVE with journey timing",
    href: "/admin/reports/clinical/clinical.donor_acceptance",
  },
  {
    id: "finance.ar_aging",
    name: "AR Aging Report",
    category: "FINANCE",
    description: "Outstanding invoice aging for collections",
    href: "/admin/reports/finance/finance.ar_aging",
  },
  {
    id: "logistics.donor_funnel",
    name: "Donor Registration Funnel",
    category: "LOGISTICS",
    description: "Lead → Converted → P2 funnel with drop-off",
    href: "/admin/reports/logistics/logistics.donor_funnel",
  },
  {
    id: "compliance.art_act_pregnancy_cap",
    name: "ART Act §29 Pregnancy Cap Tracking",
    category: "COMPLIANCE",
    description: "Cumulative pregnancy cap risk status",
    href: "/admin/reports/compliance/compliance.art_act_pregnancy_cap",
  },
];

export function fuzzyMatchReports(query: string): ReportCatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return REPORT_CATALOG;
  return REPORT_CATALOG.filter((r) => {
    const hay = `${r.name} ${r.description} ${r.category} ${r.id}`.toLowerCase();
    return q.split(/\s+/).every((token) => hay.includes(token));
  });
}
