import "server-only";

import {
  DonorPhase,
  DonorStatus,
  InvoiceStatus,
  LeadStatus,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import { countLeadsWhere } from "@/lib/leads/adapters/prisma-lead-analytics";
import type { ReportCategory } from "@prisma/client";

export type KpiValue = {
  key: string;
  label: string;
  value: number | null;
  hint: string;
  href?: string;
};

export function formatKpi(value: number | null): string {
  if (value === null || value === 0) return "—";
  return String(value);
}

export async function loadCategoryKpis(
  category: ReportCategory,
): Promise<{ kpis: KpiValue[]; chartHints: string[] }> {
  switch (category) {
    case "CLINICAL":
      return loadClinical();
    case "FINANCE":
      return loadFinance();
    case "LOGISTICS":
      return loadLogistics();
    case "COMPLIANCE":
      return loadCompliance();
    default:
      return { kpis: [], chartHints: [] };
  }
}

async function loadClinical() {
  const [active, registered, rejected, scored] = await Promise.all([
    prisma.donor.count({
      where: { phase: DonorPhase.P2_ACTIVE, status: { in: [DonorStatus.ACTIVE, DonorStatus.ELIGIBLE] } },
    }),
    prisma.donor.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.donor.count({ where: { status: DonorStatus.REJECTED } }),
    prisma.donor.count({
      where: { phase: DonorPhase.P2_ACTIVE, currentSeedScoreId: { not: null } },
    }),
  ]);
  const accepted = await prisma.donor.count({
    where: { status: { in: [DonorStatus.ACTIVE, DonorStatus.ELIGIBLE] } },
  });
  const rejectionRate =
    accepted + rejected === 0
      ? null
      : Math.round((rejected / (accepted + rejected)) * 1000) / 10;

  return {
    kpis: [
      { key: "active", label: "Active Donors", value: active || null, hint: "Donors at P2 ACTIVE this period", href: "/admin/reports/clinical/clinical.donor_acceptance" },
      { key: "new", label: "New Donors Registered", value: registered || null, hint: "Donors created in last 30 days" },
      { key: "rej", label: "Rejection Rate %", value: rejectionRate, hint: "REJECTED / (ACCEPTED + REJECTED) × 100" },
      { key: "score", label: "Scored Donors", value: scored || null, hint: "P2 donors with a SeedScore" },
      { key: "qc", label: "QC Gate Pass Rate", value: null, hint: "QC-A2–A6 combined pass rate (needs sample QC volume)" },
    ],
    chartHints: [
      "New donor registrations trend (last 12 weeks)",
      "Donor phase distribution",
    ],
  };
}

async function loadFinance() {
  const open = await prisma.invoice.findMany({
    where: {
      status: {
        in: [InvoiceStatus.RAISED, InvoiceStatus.PAID_PARTIAL, InvoiceStatus.OVERDUE],
      },
    },
    include: { payments: true },
  });
  let ar = 0;
  let overdue90 = 0;
  const now = Date.now();
  for (const inv of open) {
    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    const bal = Math.max(0, Number(inv.totalWithGst) - paid);
    ar += bal;
    const days = (now - inv.dueDate.getTime()) / (24 * 60 * 60 * 1000);
    if (days > 90 && bal > 0) overdue90 += 1;
  }
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const collections = await prisma.payment.aggregate({
    where: { paidAt: { gte: monthStart } },
    _sum: { amount: true },
  });
  const mrr = await prisma.subscription.count({ where: { status: "ACTIVE" } });

  return {
    kpis: [
      { key: "mrr", label: "Active Subscriptions", value: mrr || null, hint: "Proxy for MRR count (amount rollup Sprint 2)" },
      { key: "ar", label: "AR Outstanding (₹)", value: ar ? Math.round(ar) : null, hint: "Sum of unpaid invoice balances", href: "/admin/reports/finance/finance.ar_aging" },
      { key: "dso", label: "DSO", value: null, hint: "Days sales outstanding — needs payment lag history" },
      { key: "mtd", label: "Collections MTD (₹)", value: collections._sum.amount ? Math.round(Number(collections._sum.amount)) : null, hint: "Sum of Payment.amount month-to-date" },
      { key: "o90", label: "Overdue 90+", value: overdue90 || null, hint: "Invoices past 90 days with balance", href: "/admin/reports/finance/finance.ar_aging" },
    ],
    chartHints: ["Monthly revenue trend", "AR aging buckets"],
  };
}

async function loadLogistics() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [leads, converted, dispatches, delivered] = await Promise.all([
    countLeadsWhere({ personType: "DONOR", capturedAt: { gte: since } }),
    countLeadsWhere({
      personType: "DONOR",
      status: LeadStatus.CONVERTED,
      capturedAt: { gte: since },
    }),
    prisma.dispatchOrder.count({
      where: { createdAt: { gte: since } },
    }),
    prisma.dispatchOrder.count({
      where: { createdAt: { gte: since }, state: "DELIVERED" },
    }),
  ]);
  const conv =
    leads === 0 ? null : Math.round((converted / leads) * 1000) / 10;
  const success =
    dispatches === 0 ? null : Math.round((delivered / dispatches) * 1000) / 10;

  return {
    kpis: [
      { key: "leads", label: "Leads Captured", value: leads || null, hint: "Donor leads this period", href: "/admin/reports/logistics/logistics.donor_funnel" },
      { key: "conv", label: "Lead→Donor Conversion %", value: conv, hint: "CONVERTED / CAPTURED", href: "/admin/reports/logistics/logistics.donor_funnel" },
      { key: "dsp", label: "Dispatch Success %", value: success, hint: "DELIVERED / TOTAL_DISPATCHED" },
      { key: "tat", label: "Avg Delivery TAT (h)", value: null, hint: "Mean hours dispatch→delivery" },
      { key: "util", label: "Vial Utilization %", value: null, hint: "Allocated / total in storage" },
    ],
    chartHints: ["Lead funnel", "Dispatch success rate"],
  };
}

async function loadCompliance() {
  const donors = await prisma.donor.findMany({
    where: { status: { in: [DonorStatus.ACTIVE, DonorStatus.ELIGIBLE] } },
    select: { cumulativePregnancies: true, bankPolicyCap: true },
  });
  const within =
    donors.length === 0
      ? null
      : Math.round(
          (donors.filter((d) => d.cumulativePregnancies <= (d.bankPolicyCap ?? 5)).length /
            donors.length) *
            1000,
        ) / 10;

  return {
    kpis: [
      { key: "cap", label: "ART Act Cap Compliance %", value: within, hint: "% donors within cumulativePregnancies cap", href: "/admin/reports/compliance/compliance.art_act_pregnancy_cap" },
      { key: "consent", label: "Consent Currency %", value: null, hint: "% donors with unexpired active consents" },
      { key: "wit", label: "2-Witness Compliance %", value: null, hint: "% witness-required ops with 2 distinct users" },
      { key: "sero", label: "Serology Retest Compliance %", value: null, hint: "% QC-A6 gates passed on time" },
      { key: "audit", label: "Audit Log Integrity %", value: null, hint: "Hash chain verification pass rate" },
    ],
    chartHints: ["Consent expirations upcoming", "2-witness compliance by operation"],
  };
}
