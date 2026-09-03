import { notFound, redirect } from "next/navigation";

import {
  ForbiddenError,
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import { getReport } from "@/lib/reports/registry";
import { runReport } from "@/lib/reports/runner";
import { parseCategorySlug } from "@/lib/reports/types";
import { PrintAutoTrigger } from "@/components/reports/print-auto-trigger";

type Props = {
  params: Promise<{ category: string; reportId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportPrintPage({ params, searchParams }: Props) {
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

  const sp = await searchParams;
  const filters: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") filters[k] = v;
  }

  const result = await runReport(reportId, filters, session);
  const cols = def.columns.filter(
    (c) => c.key !== "donorId" && c.key !== "invoiceId",
  );

  return (
    <div className="mx-auto max-w-5xl bg-white p-8 text-stone-900 print:p-0">
      <PrintAutoTrigger />
      <h1 className="text-xl font-semibold">{def.name}</h1>
      <p className="mt-1 text-sm text-stone-600">{def.description}</p>
      <p className="mt-2 text-xs text-stone-500">
        Generated: {result.generatedAtIst} · Filters: {JSON.stringify(filters)} ·
        Rows: {result.rowCount}
      </p>
      {result.rowCount === 0 ? (
        <p className="mt-8 text-sm">{def.emptyStateHint}</p>
      ) : (
        <table className="mt-6 w-full border-collapse text-left text-xs">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key} className="border-b border-stone-300 py-2 pr-2 font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c.key} className="border-b border-stone-100 py-1.5 pr-2">
                    {row[c.key] == null || row[c.key] === ""
                      ? "—"
                      : String(row[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
