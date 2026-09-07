import Link from "next/link";
import { redirect } from "next/navigation";

import { CONFIG_KEY_LIST, CONFIG_LABELS, CONFIG_OWNER_ROLE } from "@/lib/leads/config/keys";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export default async function LeadConfigIndexPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "lead.config.view")) {
    redirect("/admin/leads");
  }

  const active = await prisma.leadConfig.findMany({
    where: { isActive: true },
  });
  const byKey = new Map(active.map((r) => [r.key, r]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Lead configuration</h1>
        <p className="text-sm text-stone-600">
          Versioned keys with single-approver SoD (author cannot approve).
        </p>
      </div>
      <ul className="divide-y rounded-xl border border-stone-200 bg-white">
        {CONFIG_KEY_LIST.map((key) => {
          const row = byKey.get(key);
          return (
            <li key={key} className="flex items-center justify-between px-4 py-3">
              <div>
                <Link
                  href={`/admin/leads/config/${key}`}
                  className="font-medium text-emerald-900 hover:underline"
                >
                  {CONFIG_LABELS[key]}
                </Link>
                <p className="text-xs text-stone-500">
                  {key} · owner {CONFIG_OWNER_ROLE[key]}
                  {row ? ` · v${row.version} active` : " · not seeded"}
                </p>
              </div>
              <Link
                href={`/admin/leads/config/${key}`}
                className="text-sm text-emerald-900 hover:underline"
              >
                Open
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
