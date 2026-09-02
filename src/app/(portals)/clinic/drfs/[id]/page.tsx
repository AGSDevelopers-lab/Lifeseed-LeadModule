import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { DRF_STATE_LABEL } from "@/lib/drf-state";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import {
  CHAKRA_LABEL,
  CHAKRA_ORDER,
  TIER_LABEL,
} from "@/lib/seedscore/constants";
import {
  getSeedScoreVisibility,
  tierBadgeClass,
} from "@/lib/seedscore/visibility";
import { cn } from "@/lib/utils";

type Params = Promise<{ id: string }>;

const TIMELINE = [
  "DRAFT",
  "SUBMITTED",
  "ACCEPTED",
  "ALLOCATED",
  "IN_TRANSIT",
  "DELIVERED",
  "IN_CYCLE",
  "OUTCOME_PENDING",
  "CLOSED",
] as const;

export default async function ClinicDrfDetailPage({
  params,
}: {
  params: Params;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "drf.view")) {
    redirect("/clinic/drfs");
  }
  if (!session.clinicId) redirect("/clinic/drfs");

  const { id } = await params;
  const drf = await prisma.dRF.findFirst({
    where: { id, clinicId: session.clinicId },
    include: { site: true, clinic: true },
  });
  if (!drf) notFound();

  const allocatedDonor = drf.allocatedDonorId
    ? await prisma.donor.findUnique({
        where: { id: drf.allocatedDonorId },
        include: { seedScore: true },
      })
    : null;

  const seedVis = getSeedScoreVisibility(session.roles, {
    clinicOwnsDrf: true,
  });

  const events = await prisma.auditLog.findMany({
    where: { entityType: "DRF", entityId: drf.id },
    orderBy: { timestamp: "asc" },
    take: 40,
  });

  const stateIdx = TIMELINE.indexOf(
    drf.state as (typeof TIMELINE)[number],
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/clinic/drfs"
          className="text-sm text-emerald-900 hover:underline"
        >
          ← Back to DRFs
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-stone-900">
          {drf.drfNumber}
        </h1>
        <p className="text-sm text-stone-600">
          {DRF_STATE_LABEL[drf.state]} · {drf.type} · {drf.priority} · site{" "}
          {drf.site.code}
        </p>
      </div>

      <ol className="flex flex-wrap gap-2">
        {TIMELINE.map((s, i) => (
          <li
            key={s}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs ring-1",
              i <= stateIdx && drf.state !== "CANCELLED"
                ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                : "bg-stone-50 text-stone-400 ring-stone-200",
            )}
          >
            {DRF_STATE_LABEL[s]}
          </li>
        ))}
      </ol>

      {allocatedDonor && seedVis.showTier && (
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-900">
            Allocated donor SeedScore
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            {allocatedDonor.donorCode}
            {seedVis.showNumeric && allocatedDonor.seedScore
              ? ` · ${allocatedDonor.seedScore.totalScore}/100`
              : ""}
          </p>
          <span
            className={cn(
              "mt-2 inline-block rounded-md px-2 py-0.5 text-xs font-medium",
              tierBadgeClass(allocatedDonor.currentTier),
            )}
          >
            {TIER_LABEL[allocatedDonor.currentTier ?? "UNSCORED"]}
          </span>
          {seedVis.showBreakdown && allocatedDonor.seedScore && (
            <ul className="mt-3 grid grid-cols-2 gap-1 text-xs text-stone-700 sm:grid-cols-4">
              {CHAKRA_ORDER.map((c) => {
                const map = {
                  ROOT: allocatedDonor.seedScore!.rootScore,
                  SACRAL: allocatedDonor.seedScore!.sacralScore,
                  SOLAR_PLEXUS: allocatedDonor.seedScore!.solarPlexusScore,
                  HEART: allocatedDonor.seedScore!.heartScore,
                  THROAT: allocatedDonor.seedScore!.throatScore,
                  THIRD_EYE: allocatedDonor.seedScore!.thirdEyeScore,
                  CROWN: allocatedDonor.seedScore!.crownScore,
                };
                return (
                  <li key={c}>
                    {CHAKRA_LABEL[c]}: {map[c]}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <ul className="space-y-1 rounded-xl border border-stone-200 bg-white p-4 text-xs text-stone-600">
        {events.map((e) => (
          <li key={e.id}>
            {e.timestamp.toISOString()} · {e.action}
          </li>
        ))}
        {events.length === 0 && <li>No events yet.</li>}
      </ul>
    </div>
  );
}
