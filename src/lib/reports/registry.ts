import "server-only";

import type { ReportCategory, UserRole } from "@prisma/client";

import { ForbiddenError } from "@/lib/rbac";
import { artActPregnancyCapReport } from "@/lib/reports/definitions/compliance-art-act-pregnancy-cap";
import { donorAcceptanceReport } from "@/lib/reports/definitions/clinical-donor-acceptance";
import { arAgingReport } from "@/lib/reports/definitions/finance-ar-aging";
import { donorFunnelReport } from "@/lib/reports/definitions/logistics-donor-funnel";
import type { ReportDefinition, ReportSessionUser } from "@/lib/reports/types";

export const reportRegistry: Record<string, ReportDefinition> = {
  [donorAcceptanceReport.id]: donorAcceptanceReport,
  [arAgingReport.id]: arAgingReport,
  [donorFunnelReport.id]: donorFunnelReport,
  [artActPregnancyCapReport.id]: artActPregnancyCapReport,
};

function userCanAccessReport(
  def: ReportDefinition,
  user: ReportSessionUser,
): boolean {
  if (user.roles.includes("BANK_SUPER_ADMIN")) return true;
  if (user.roles.includes("OPS_MANAGER")) return true;
  return def.allowedRoles.some((r) => user.roles.includes(r));
}

export function listReports(user: ReportSessionUser): ReportDefinition[] {
  return Object.values(reportRegistry).filter((d) =>
    userCanAccessReport(d, user),
  );
}

export function getReport(id: string, user: ReportSessionUser): ReportDefinition {
  const def = reportRegistry[id];
  if (!def) {
    throw new ForbiddenError(`report.run.${id}`);
  }
  if (!userCanAccessReport(def, user)) {
    throw new ForbiddenError(`report.run.${id}`);
  }
  return def;
}

export function getReportsByCategory(
  category: ReportCategory,
  user: ReportSessionUser,
): ReportDefinition[] {
  return listReports(user).filter((d) => d.category === category);
}

export function resolveScopeWhere(
  def: ReportDefinition,
  user: ReportSessionUser,
): Record<string, unknown> | undefined {
  const parts: Record<string, unknown>[] = [];
  for (const role of user.roles as UserRole[]) {
    const extra = def.scopedByRole?.(role, user);
    if (extra) parts.push(extra);
  }
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return { AND: parts };
}
