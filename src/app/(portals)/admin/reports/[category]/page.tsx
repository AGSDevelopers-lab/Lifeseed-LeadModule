import Link from "next/link";
import { redirect, notFound } from "next/navigation";

import { KpiCard } from "@/components/reports/kpi-card";
import { ReportsCommandBar } from "@/components/reports/reports-command-bar";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import { formatKpi, loadCategoryKpis } from "@/lib/reports/dashboards";
import { getReportsByCategory } from "@/lib/reports/registry";
import { parseCategorySlug } from "@/lib/reports/types";
import { WONG_PALETTE } from "@/lib/reports/charts/accessible-palette";
import { CategoryCharts } from "@/components/reports/category-charts";

type Props = { params: Promise<{ category: string }> };

export default async function CategoryDashboardPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "report.list")) {
    redirect("/admin");
  }

  const { category: slug } = await params;
  const category = parseCategorySlug(slug);
  if (!category) notFound();

  if (category === "REGULATORY" || category === "OPERATIONAL") {
    return (
      <div className="space-y-4 p-6">
        <ReportsCommandBar />
        <Link href="/admin/reports" className="text-sm text-emerald-800 hover:underline">
          ← Reports home
        </Link>
        <h1 className="text-2xl font-semibold capitalize">{slug} dashboard</h1>
        <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-10 text-sm text-stone-600">
          Coming soon — this dashboard ships in a later sprint.
        </p>
      </div>
    );
  }

  const viewPerm = `report.view.${slug}`;
  const held = permissionsForRoles(session.roles);
  const canView =
    permissionGranted(held, viewPerm) ||
    permissionGranted(held, "report.view.*") ||
    permissionGranted(held, "report.*") ||
    permissionGranted(held, `${viewPerm}.own_clinic`);
  if (!canView) redirect("/admin/reports");

  const [{ kpis, chartHints }, reports] = await Promise.all([
    loadCategoryKpis(category),
    Promise.resolve(getReportsByCategory(category, session)),
  ]);

  return (
    <div className="space-y-6 p-6">
      <ReportsCommandBar />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/reports" className="text-sm text-emerald-800 hover:underline">
            ← Reports home
          </Link>
          <h1 className="text-2xl font-semibold capitalize text-stone-900">
            {slug} dashboard
          </h1>
          <p className="text-sm text-stone-600">
            KPIs, trends, and report tiles for this category.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) => (
          <KpiCard
            key={k.key}
            label={k.label}
            value={formatKpi(k.value)}
            hint={k.hint}
            href={k.href}
          />
        ))}
      </div>

      <CategoryCharts
        category={slug}
        hints={chartHints}
        colors={[...WONG_PALETTE]}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Available reports
        </h2>
        {reports.length === 0 ? (
          <p className="text-sm text-stone-600">No reports available for your role in this category.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((r) => (
              <Link
                key={r.id}
                href={`/admin/reports/${slug}/${r.id}`}
                className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm hover:border-emerald-400"
                title={r.description}
              >
                <div className="font-medium text-stone-900">{r.name}</div>
                <p className="mt-1 line-clamp-2 text-sm text-stone-600">{r.description}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
