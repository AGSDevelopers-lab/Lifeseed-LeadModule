import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { CYCLE_EVENT_LABEL } from "@/lib/embryology/labels";
import {
  cohortKpis,
  parseClinicThresholds,
} from "@/lib/embryology/vienna-kpis";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import { cn } from "@/lib/utils";

type PageProps = { params: Promise<{ drfId: string }> };

export default async function ClinicCycleDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "cycle.view")) {
    redirect("/clinic");
  }

  const { drfId } = await params;
  const drf = await prisma.dRF.findUnique({
    where: { id: drfId },
    include: {
      clinic: true,
      cohort: { include: { embryos: true } },
      cycleEvents: { orderBy: { occurredAt: "asc" } },
    },
  });
  if (!drf) notFound();
  if (session.clinicId && session.clinicId !== drf.clinicId) {
    redirect("/clinic/cycles");
  }

  const donor = drf.allocatedDonorId
    ? await prisma.donor.findUnique({
        where: { id: drf.allocatedDonorId },
        select: { donorCode: true, type: true },
      })
    : null;

  const thresholds = parseClinicThresholds(drf.clinic.embryologyConfig);
  const kpis = drf.cohort
    ? cohortKpis(drf.cohort, drf.cohort.embryos, thresholds)
    : null;

  const canLog = permissionGranted(
    permissionsForRoles(session.roles),
    "cycle.log_event",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">
            Cycle detail
          </p>
          <h1 className="text-2xl font-semibold text-stone-900">
            {drf.drfNumber}
          </h1>
          <p className="text-sm text-stone-600">
            Donor {donor?.donorCode ?? "—"} · {drf.type} · phase{" "}
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900">
              {drf.cohort?.currentPhase ?? "E0"}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          {canLog && (
            <Link href={`/clinic/cycles/${drfId}/log-event`}>
              <Button>Log new event</Button>
            </Link>
          )}
          <Link href={`/clinic/cohorts/${drfId}`}>
            <Button variant="outline">View cohort</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cohort summary</CardTitle>
          </CardHeader>
          <CardContent>
            {!drf.cohort ? (
              <p className="text-sm text-stone-500">
                Cohort shell creates on Delivered.
              </p>
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-stone-500">Oocytes</dt>
                  <dd className="font-medium">
                    {drf.cohort.oocytesRetrieved ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">MII</dt>
                  <dd className="font-medium">{drf.cohort.miiCount ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">2PN</dt>
                  <dd className="font-medium">
                    {drf.cohort.day1_2pnCount ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">Day 5 blasts</dt>
                  <dd className="font-medium">
                    {drf.cohort.day5BlastCount ?? "—"}
                  </dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vienna KPIs (this cohort)</CardTitle>
          </CardHeader>
          <CardContent>
            {!kpis ? (
              <p className="text-sm text-stone-500">No cohort yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(
                  [
                    ["Fertilization", kpis.fertRate, kpis.thresholds.fertRate, "fertRate"],
                    ["Cleavage", kpis.cleavageRate, kpis.thresholds.cleavageRate, "cleavageRate"],
                    ["Blastocyst", kpis.blastRate, kpis.thresholds.blastRate, "blastRate"],
                    ["Good blast (≥3BB)", kpis.goodBlastRate, kpis.thresholds.goodBlastRate, "goodBlastRate"],
                  ] as const
                ).map(([label, value, thr, key]) => (
                  <li
                    key={key}
                    className={cn(
                      "flex justify-between rounded-md px-2 py-1",
                      kpis.below.includes(key) && "bg-red-50 text-red-900",
                    )}
                  >
                    <span>{label}</span>
                    <span className="font-medium">
                      {value == null ? "—" : `${value.toFixed(0)}%`}
                      <span className="ml-1 text-xs text-stone-500">
                        (≥{thr}%)
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Event timeline</h2>
        <div className="space-y-3">
          {drf.cycleEvents.length === 0 && (
            <p className="text-sm text-stone-500">No events logged yet.</p>
          )}
          {drf.cycleEvents.map((ev) => (
            <Card key={ev.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 py-4">
                <div>
                  <div className="font-medium text-stone-900">
                    {CYCLE_EVENT_LABEL[ev.eventType]}
                  </div>
                  <div className="text-xs text-stone-500">
                    {ev.occurredAt.toISOString().replace("T", " ").slice(0, 16)}{" "}
                    UTC · {ev.location}
                  </div>
                  <pre className="mt-2 max-w-xl overflow-auto rounded-md bg-stone-50 p-2 text-xs text-stone-700">
                    {JSON.stringify(ev.payload, null, 2)}
                  </pre>
                </div>
                <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs">
                  {ev.eventType}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
