import { notFound, redirect } from "next/navigation";

import { ReportDetailClient } from "@/components/reports/report-detail-client";
import { ReportsCommandBar } from "@/components/reports/reports-command-bar";
import {
  ForbiddenError,
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import { getReport } from "@/lib/reports/registry";
import { parseCategorySlug } from "@/lib/reports/types";

type Props = {
  params: Promise<{ category: string; reportId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportDetailPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "report.list")) {
    redirect("/admin");
  }

  const { category: slug, reportId } = await params;
  const category = parseCategorySlug(slug);
  if (!category) notFound();

  let def;
  try {
    def = getReport(reportId, session);
  } catch (e) {
    if (e instanceof ForbiddenError) redirect("/admin/reports");
    throw e;
  }
  if (def.category !== category) notFound();

  const sp = await searchParams;
  const initialFilters: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") initialFilters[k] = v;
  }

  return (
    <div className="p-6">
      <ReportsCommandBar />
      <ReportDetailClient
        reportId={def.id}
        category={slug}
        name={def.name}
        description={def.description}
        emptyStateHint={def.emptyStateHint}
        filters={def.filters}
        columns={def.columns}
        exportFormats={def.exportFormats}
        initialFilters={initialFilters}
      />
    </div>
  );
}
