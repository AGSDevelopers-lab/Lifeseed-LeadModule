import Link from "next/link";
import { redirect } from "next/navigation";

import { ReportsCommandBar } from "@/components/reports/reports-command-bar";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import { REPORT_CATALOG } from "@/lib/reports/catalog";
import { listReports } from "@/lib/reports/registry";
import { categorySlug } from "@/lib/reports/types";

const CATEGORIES = [
  {
    key: "CLINICAL",
    title: "Clinical",
    blurb: "Donor pipeline, lab QC, SeedScore wellness",
  },
  {
    key: "FINANCE",
    title: "Finance",
    blurb: "AR aging, revenue, collections, GST extracts",
  },
  {
    key: "LOGISTICS",
    title: "Logistics",
    blurb: "Lead funnel, dispatch TAT, vial utilization",
  },
  {
    key: "COMPLIANCE",
    title: "Compliance",
    blurb: "ART Act caps, consent audit, 2-witness rates",
  },
  {
    key: "REGULATORY",
    title: "Regulatory",
    blurb: "ICMR registry & ministry filings",
  },
] as const;

export default async function ReportsHomePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "report.list")) {
    redirect("/admin");
  }

  const reports = listReports(session);
  const favorites = await prisma.reportFavorite.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return (
    <div className="space-y-8 p-6">
      <ReportsCommandBar />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Reports</h1>
          <p className="mt-1 text-sm text-stone-600">
            Operational intelligence across clinical, finance, logistics, and compliance.
            Press <kbd className="rounded border border-stone-300 bg-stone-100 px-1">Ctrl</kbd>+
            <kbd className="rounded border border-stone-300 bg-stone-100 px-1">K</kbd> to search.
          </p>
        </div>
        <Link
          href="/admin/reports/schedules"
          className="text-sm font-medium text-emerald-800 hover:underline"
        >
          Manage schedules →
        </Link>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          My Favorites
        </h2>
        {favorites.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-600">
            No favorites yet — open a report and click the star to bookmark filters.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {favorites.map((f) => {
              const cat =
                REPORT_CATALOG.find((c) => c.id === f.reportId)?.category.toLowerCase() ??
                "clinical";
              const params = new URLSearchParams();
              if (f.savedFilters && typeof f.savedFilters === "object" && !Array.isArray(f.savedFilters)) {
                for (const [k, v] of Object.entries(
                  f.savedFilters as Record<string, unknown>,
                )) {
                  if (v !== null && v !== undefined && v !== "") {
                    params.set(k, String(v));
                  }
                }
              }
              const qs = params.toString();
              return (
                <Link
                  key={f.id}
                  href={`/admin/reports/${cat}/${f.reportId}${qs ? `?${qs}` : ""}`}
                  className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm hover:border-emerald-300"
                >
                  <div className="font-medium text-stone-900">{f.displayName}</div>
                  <div className="mt-1 text-xs text-stone-500">{f.reportId}</div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Categories
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CATEGORIES.map((cat) => {
            const count = reports.filter((r) => r.category === cat.key).length;
            const href = `/admin/reports/${categorySlug(cat.key)}`;
            return (
              <Link
                key={cat.key}
                href={href}
                className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-emerald-400 hover:shadow"
              >
                <div className="text-lg font-semibold text-emerald-900">{cat.title}</div>
                <p className="mt-1 text-sm text-stone-600">{cat.blurb}</p>
                <div className="mt-4 text-xs font-medium text-stone-500">
                  {cat.key === "REGULATORY"
                    ? "Coming soon"
                    : `${count} report${count === 1 ? "" : "s"} accessible`}{" "}
                  · See more →
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
