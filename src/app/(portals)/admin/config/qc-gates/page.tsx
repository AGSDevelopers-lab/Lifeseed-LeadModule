import { redirect } from "next/navigation";

import { QcGatesForm } from "./qc-gates-form";
import { prisma } from "@/lib/db";
import { ALL_QC_GATES, listQcGateConfigs, POST_THAW_PARAM_GATES } from "@/lib/qc-config";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type SearchParams = Promise<{ site?: string }>;

export default async function QcGatesConfigPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "sample.qc")) {
    redirect("/admin");
  }

  const sites = await prisma.site.findMany({ orderBy: { code: "asc" } });
  if (sites.length === 0) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">QC Gates</h1>
        <p className="text-sm text-stone-600">No sites configured.</p>
      </div>
    );
  }

  const sp = await searchParams;
  const siteId =
    sites.find((s) => s.id === sp.site)?.id ?? sites[0].id;
  const site = sites.find((s) => s.id === siteId)!;

  const gates = await listQcGateConfigs(siteId);
  const main = gates.filter((g) =>
    (ALL_QC_GATES as string[]).includes(g.gateName),
  );
  const postThaw = gates.filter((g) =>
    (POST_THAW_PARAM_GATES as string[]).includes(g.gateName),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">QC Gates</h1>
        <p className="text-sm text-stone-600">
          Per-site toggles for QC-A1–A5 and post-thaw parameters. QC-A6 cannot be
          disabled (ICMR).
        </p>
      </div>

      <form method="get" className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Site
          <select
            name="site"
            defaultValue={siteId}
            className="h-10 rounded-md border border-stone-300 px-2 text-sm"
            onChange={undefined}
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-10 rounded-md bg-emerald-800 px-4 text-sm text-white"
        >
          Load
        </button>
      </form>

      <p className="text-sm text-stone-700">
        Editing: <strong>{site.code}</strong>
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Pipeline gates
        </h2>
        <QcGatesForm siteId={siteId} gates={main} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Post-thaw parameters
        </h2>
        <QcGatesForm siteId={siteId} gates={postThaw} />
      </section>
    </div>
  );
}
