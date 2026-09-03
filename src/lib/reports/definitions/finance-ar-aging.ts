import "server-only";

import { InvoiceStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { ReportDefinition, ReportFilters } from "@/lib/reports/types";

const OPEN: InvoiceStatus[] = [
  InvoiceStatus.RAISED,
  InvoiceStatus.PAID_PARTIAL,
  InvoiceStatus.OVERDUE,
];

function agingBucket(daysOverdue: number): string {
  if (daysOverdue <= 30) return "0-30";
  if (daysOverdue <= 60) return "30-60";
  if (daysOverdue <= 90) return "60-90";
  return "90+";
}

export const arAgingReport: ReportDefinition = {
  id: "finance.ar_aging",
  name: "AR Aging Report",
  category: "FINANCE",
  description: "Outstanding invoice aging for collections follow-up.",
  emptyStateHint:
    "No data yet — data will populate as invoices are raised",
  allowedRoles: [
    "BANK_SUPER_ADMIN",
    "BANK_CFO",
    "BANK_ACCOUNTS_MANAGER",
    "BANK_FINANCE",
    "OPS_MANAGER",
    "CLINIC_DOCTOR",
    "CLINIC_COORDINATOR",
  ],
  filters: [
    {
      key: "asOfDate",
      label: "As-of date",
      description: "Aging computed relative to this date (defaults today)",
      widget: "date-range",
    },
    {
      key: "clinicId",
      label: "Clinic",
      description: "Filter by buyer clinic id",
      widget: "text",
    },
    {
      key: "agingBucket",
      label: "Aging bucket",
      description: "0-30 · 30-60 · 60-90 · 90+",
      widget: "single-select",
      options: [
        { value: "ALL", label: "All" },
        { value: "0-30", label: "0–30 days" },
        { value: "30-60", label: "30–60 days" },
        { value: "60-90", label: "60–90 days" },
        { value: "90+", label: "90+ days" },
      ],
      defaultValue: "ALL",
    },
  ],
  columns: [
    { key: "invoiceNumber", label: "Invoice Number", sortable: true },
    { key: "clinic", label: "Clinic / Buyer", description: "Invoice.buyerId" },
    { key: "raisedAt", label: "Raised At", formatter: "date", sortable: true },
    { key: "dueAt", label: "Due At", formatter: "date" },
    { key: "daysOverdue", label: "Days Overdue", formatter: "number", numeric: true, higherIsBetter: false, sortable: true },
    { key: "agingBucket", label: "Bucket", formatter: "badge" },
    { key: "originalAmount", label: "Original Amount", formatter: "money", numeric: true },
    { key: "paidAmount", label: "Paid Amount", formatter: "money", numeric: true },
    { key: "balance", label: "Balance", formatter: "money", numeric: true, higherIsBetter: false, sortable: true },
    { key: "dunningStage", label: "Dunning Stage", formatter: "badge" },
    { key: "invoiceId", label: "Invoice ID" },
  ],
  async query(filters, scope) {
    const asOf = filters.asOfDate
      ? new Date(String(filters.asOfDate))
      : new Date();

    const where: Prisma.InvoiceWhereInput = {
      status: { in: OPEN },
      ...(scope.extraWhere as Prisma.InvoiceWhereInput | undefined),
    };
    if (filters.clinicId) {
      where.buyerId = String(filters.clinicId);
      where.buyerType = "CLINIC";
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        payments: true,
        site: true,
      },
      orderBy: { dueDate: "asc" },
      take: Number(process.env.REPORTS_MAX_ROWS_PER_PAGE ?? 5000),
    });

    const bucketFilter =
      filters.agingBucket && filters.agingBucket !== "ALL"
        ? String(filters.agingBucket)
        : null;

    return invoices
      .map((inv) => {
        const paid = inv.payments.reduce(
          (sum, p) => sum + Number(p.amount.toString()),
          0,
        );
        const original = Number(inv.totalWithGst.toString());
        const balance = Math.max(0, original - paid);
        const daysOverdue = Math.max(
          0,
          Math.floor(
            (asOf.getTime() - inv.dueDate.getTime()) / (24 * 60 * 60 * 1000),
          ),
        );
        const bucket = agingBucket(daysOverdue);
        return {
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          clinic: inv.buyerId,
          siteCode: inv.site.code,
          raisedAt: inv.issuedAt.toISOString(),
          dueAt: inv.dueDate.toISOString(),
          daysOverdue,
          agingBucket: bucket,
          originalAmount: original,
          paidAmount: paid,
          balance,
          dunningStage: inv.dunningStage,
        };
      })
      .filter((r) => r.balance > 0)
      .filter((r) => (bucketFilter ? r.agingBucket === bucketFilter : true));
  },
  scopedByRole(role, user) {
    if (
      (role === "CLINIC_DOCTOR" || role === "CLINIC_COORDINATOR") &&
      user.clinicId
    ) {
      return { buyerId: user.clinicId, buyerType: "CLINIC" };
    }
    if (user.siteId && role !== "BANK_SUPER_ADMIN" && role !== "OPS_MANAGER") {
      return { siteId: user.siteId };
    }
    return undefined;
  },
  drillDownTarget(row) {
    const id = row.invoiceId;
    return typeof id === "string" ? `/admin/invoices/${id}` : null;
  },
  exportFormats: ["CSV", "XLSX", "PDF"],
  scheduling: { allowedCadences: ["DAILY", "WEEKLY", "MONTHLY"] },
  caching: { ttlSeconds: 180, invalidateOn: ["invoice.updated", "payment.recorded"] },
};
