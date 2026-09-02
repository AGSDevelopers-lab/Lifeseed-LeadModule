import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OverrideGateForm } from "@/app/(portals)/admin/donors/[id]/override-seedscore-gate/override-form";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import { TIER_LABEL } from "@/lib/seedscore/constants";

type Params = Promise<{ id: string }>;

export default async function OverrideSeedScoreGatePage({
  params,
}: {
  params: Params;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(
      permissionsForRoles(session.roles),
      "seedscore.override.tier",
    )
  ) {
    redirect("/admin/donors");
  }

  const { id } = await params;
  const donor = await prisma.donor.findUnique({ where: { id } });
  if (!donor) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href={`/admin/donors/${id}?tab=seedscore`}
          className="text-sm text-emerald-900 hover:underline"
        >
          ← SeedScore
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          Override SeedScore gate
        </h1>
        <p className="text-sm text-stone-600">
          {donor.donorCode} · tier{" "}
          {TIER_LABEL[donor.currentTier ?? "UNSCORED"]} · phase {donor.phase}
        </p>
        <p className="mt-2 text-sm text-amber-800">
          Only use when SEEDSCORE_GATE_ENABLED blocks P1→P2 for Not Recommended.
          Action is audited.
        </p>
      </div>
      <OverrideGateForm donorId={donor.id} />
    </div>
  );
}
