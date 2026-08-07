import { redirect } from "next/navigation";

import { CategoriesForm } from "./categories-form";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type SearchParams = Promise<{ site?: string }>;

const DEFAULT_RULES = {
  premium: {
    minGrade: "A",
    donorPhenotype: "TOP_TIER",
    packageEligibility: ["PREMIUM"],
  },
  standard: {
    minGrades: ["A", "B"],
    packageEligibility: ["PREMIUM", "STANDARD"],
  },
  economy: {
    maxGrade: "C",
    packageEligibility: ["BASIC", "ECONOMY"],
  },
};

export default async function CategoriesConfigPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(permissionsForRoles(session.roles), "sample.close") &&
    !permissionGranted(permissionsForRoles(session.roles), "sample.*")
  ) {
    redirect("/admin");
  }

  const sites = await prisma.site.findMany({ orderBy: { code: "asc" } });
  if (sites.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="text-sm text-stone-600">No sites configured.</p>
      </div>
    );
  }

  const sp = await searchParams;
  const siteId = sites.find((s) => s.id === sp.site)?.id ?? sites[0].id;
  const site = sites.find((s) => s.id === siteId)!;

  const [config, tanks] = await Promise.all([
    prisma.categoryRuleConfig.findUnique({ where: { siteId } }),
    prisma.cryoTank.findMany({ orderBy: { tankCode: "asc" } }),
  ]);

  const rulesJson = config?.rulesJson
    ? JSON.stringify(config.rulesJson, null, 2)
    : JSON.stringify(DEFAULT_RULES, null, 2);
  const tankMapping =
    (config?.tankMappingJson as Record<string, string> | null) ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">
          Category composite rules
        </h1>
        <p className="text-sm text-stone-600">
          Map grade + phenotype + package eligibility to PREMIUM / STANDARD /
          ECONOMY and default tanks (PRM / STD / ECN prefixes).
        </p>
      </div>

      <form method="get" className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Site
          <select
            name="site"
            defaultValue={siteId}
            className="h-10 rounded-md border border-stone-300 px-2 text-sm"
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

      <CategoriesForm
        siteId={siteId}
        initialRulesJson={rulesJson}
        initialTankMapping={tankMapping}
        tanks={tanks}
      />
    </div>
  );
}
