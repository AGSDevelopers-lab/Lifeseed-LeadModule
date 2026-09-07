import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { LeadConfigKeyClient } from "@/app/(portals)/admin/leads/config/config-key-client";
import { isConfigKey, CONFIG_LABELS, CONFIG_OWNER_ROLE } from "@/lib/leads/config/keys";
import { canMutateConfigKey } from "@/lib/leads/config/ownership";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export default async function LeadConfigKeyPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const perms = permissionsForRoles(session.roles);
  if (!permissionGranted(perms, "lead.config.view")) redirect("/admin/leads");

  const { key: raw } = await params;
  if (!isConfigKey(raw)) notFound();

  const history = await prisma.leadConfig.findMany({
    where: { key: raw },
    orderBy: { version: "desc" },
  });
  const current = history.find((r) => r.isActive) ?? null;
  const pending = history.filter((r) => !r.approvedAt);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/leads/config" className="text-sm text-emerald-900 hover:underline">
          ← All keys
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{CONFIG_LABELS[raw]}</h1>
        <p className="text-sm text-stone-600">
          {raw} · owner {CONFIG_OWNER_ROLE[raw]}
        </p>
      </div>
      <LeadConfigKeyClient
        configKey={raw}
        actorUserId={session.userId}
        canPropose={
          permissionGranted(perms, "lead.config.propose") &&
          canMutateConfigKey(session.roles, raw)
        }
        canApprove={
          permissionGranted(perms, "lead.config.approve") &&
          canMutateConfigKey(session.roles, raw)
        }
        current={
          current
            ? {
                version: current.version,
                payload: current.payload as Record<string, unknown>,
                effectiveFrom: current.effectiveFrom?.toISOString() ?? null,
                effectiveUntil: current.effectiveUntil?.toISOString() ?? null,
                approvedByUserId: current.approvedByUserId,
                approvedAt: current.approvedAt?.toISOString() ?? null,
                createdByUserId: current.createdByUserId,
                notes: current.notes,
              }
            : null
        }
        history={history.map((r) => ({
          id: r.id,
          version: r.version,
          isActive: r.isActive,
          createdByUserId: r.createdByUserId,
          createdAt: r.createdAt.toISOString(),
          approvedByUserId: r.approvedByUserId,
          approvedAt: r.approvedAt?.toISOString() ?? null,
          effectiveFrom: r.effectiveFrom?.toISOString() ?? null,
          effectiveUntil: r.effectiveUntil?.toISOString() ?? null,
          notes: r.notes,
          payload: r.payload as Record<string, unknown>,
        }))}
        pendingCount={pending.length}
      />
    </div>
  );
}
