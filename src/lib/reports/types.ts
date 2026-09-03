import type { ReportCategory, UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";

/** Minimal session shape for report scoping (avoids importing server rbac into client). */
export type ReportSessionUser = {
  userId: string;
  email: string;
  roles: UserRole[];
  siteId: string | null;
  clinicId: string | null;
};

export type ReportFilterWidget =
  | "date-range"
  | "multi-select"
  | "single-select"
  | "text"
  | "number-range";

export type FilterDefinition = {
  key: string;
  label: string;
  description?: string;
  widget: ReportFilterWidget;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: unknown;
};

export type ColumnFormatter =
  | "text"
  | "date"
  | "datetime"
  | "number"
  | "percent"
  | "money"
  | "badge"
  | "boolean"
  | "link";

export type ColumnDefinition = {
  key: string;
  label: string;
  description?: string;
  formatter?: ColumnFormatter;
  sortable?: boolean;
  /** When true, ↑ green / ↓ red for positive deltas; flip when false. */
  higherIsBetter?: boolean;
  numeric?: boolean;
};

export type ScopedFilter =
  | Prisma.Enumerable<Prisma.DonorWhereInput>
  | Record<string, unknown>;

export type ReportFilters = Record<string, unknown>;

export type ReportRow = Record<string, unknown>;

export type ReportQueryScope = {
  user: ReportSessionUser;
  extraWhere?: Record<string, unknown>;
};

export type ReportSchedulingConfig = {
  allowedCadences: Array<"DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY">;
  defaultSubscribers?: UserRole[];
};

export type ReportCachingConfig = {
  ttlSeconds: number;
  invalidateOn: string[];
};

export type ReportDefinition = {
  id: string;
  name: string;
  category: ReportCategory;
  description: string;
  emptyStateHint: string;
  allowedRoles: UserRole[];
  filters: FilterDefinition[];
  columns: ColumnDefinition[];
  query: (
    filters: ReportFilters,
    scope: ReportQueryScope,
  ) => Promise<ReportRow[]>;
  scopedByRole?: (
    role: UserRole,
    user: ReportSessionUser,
  ) => Record<string, unknown> | undefined;
  drillDownTarget?: (row: ReportRow) => string | null;
  exportFormats: Array<"CSV" | "XLSX" | "PDF">;
  scheduling?: ReportSchedulingConfig;
  caching?: ReportCachingConfig;
};

export type ReportRunResult = {
  reportId: string;
  name: string;
  category: ReportCategory;
  rows: ReportRow[];
  rowCount: number;
  generatedAt: string;
  generatedAtIst: string;
  filters: ReportFilters;
  columns: ColumnDefinition[];
  fromCache: boolean;
};

export type ExportFormat = "CSV" | "XLSX" | "PDF" | "JSON";

export const REPORT_CATEGORIES: ReportCategory[] = [
  "CLINICAL",
  "FINANCE",
  "LOGISTICS",
  "COMPLIANCE",
  "REGULATORY",
  "OPERATIONAL",
];

export function categorySlug(category: ReportCategory): string {
  return category.toLowerCase();
}

export function parseCategorySlug(slug: string): ReportCategory | null {
  const upper = slug.toUpperCase() as ReportCategory;
  return REPORT_CATEGORIES.includes(upper) ? upper : null;
}
