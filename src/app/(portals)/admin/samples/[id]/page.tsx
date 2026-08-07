import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SampleState } from "@prisma/client";

import { PhaseActions } from "./phase-actions";
import { markCryopreserved } from "@/app/(portals)/admin/samples/actions";
import { Button } from "@/components/ui/primitives";
import { prisma } from "@/lib/db";
import { SAMPLE_STATE_LABEL } from "@/lib/sample-state";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import { cn } from "@/lib/utils";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ tab?: string }>;

const TABS = [
  { key: "a0", label: "Accessioning", states: ["DRAFT", "ACCESSIONED"] },
  { key: "a1", label: "Analysis", states: ["ACCESSIONED", "ANALYZED"] },
  { key: "a2", label: "Advanced", states: ["ANALYZED", "ADVANCED_TESTING"] },
  { key: "a3", label: "Decision", states: ["ADVANCED_TESTING", "DECIDED"] },
  { key: "a4", label: "Preparation", states: ["DECIDED", "PREPARED"] },
  { key: "a5", label: "Vialing", states: ["PREPARED", "VIALED"] },
  { key: "a6", label: "Cryo", states: ["VIALED", "CRYOPRESERVED"] },
  { key: "a7", label: "QC-A5", states: ["CRYOPRESERVED", "QC_A5_PENDING"] },
  { key: "a8", label: "Quarantine", states: ["QUARANTINE"] },
  {
    key: "a9",
    label: "Post-thaw",
    states: ["POST_THAW_ANALYZED", "QUARANTINE", "QC_A5_PENDING"],
  },
] as const;

export default async function SampleDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "sample.view")) {
    redirect("/admin/samples");
  }

  const { id } = await params;
  const { tab } = await searchParams;

  const sample = await prisma.sample.findUnique({
    where: { id },
    include: {
      donor: true,
      site: true,
      vials: { include: { tank: true } },
    },
  });
  if (!sample) notFound();

  const witnesses = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { not: session.userId },
      roles: {
        some: {
          role: {
            in: [
              "BANK_WITNESS",
              "BANK_CRYOBANK_TECH",
              "BANK_LAB_HEAD",
              "BANK_SR_ANDROLOGIST",
              "BANK_ANDROLOGY_TECH",
              "BANK_QC_OFFICER",
              "BANK_SUPER_ADMIN",
            ],
          },
        },
      },
    },
    select: { id: true, email: true },
    take: 50,
  });

  const activeTab =
    TABS.find((t) => t.key === tab)?.key ??
    TABS.find((t) => (t.states as readonly string[]).includes(sample.state))
      ?.key ??
    "a0";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-stone-500">{sample.sampleCode}</div>
          <h1 className="text-2xl font-semibold text-stone-900">
            <Link
              href={`/admin/donors/${sample.donorId}`}
              className="hover:underline"
            >
              {sample.donor.fullName}
            </Link>
          </h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Pill>{SAMPLE_STATE_LABEL[sample.state]}</Pill>
            <Pill tone={sample.priority === "URGENT" ? "warn" : "neutral"}>
              {sample.priority}
            </Pill>
            <Pill>{sample.releaseTiming}</Pill>
            {sample.category && <Pill tone="ok">{sample.category}</Pill>}
            {sample.grade && <Pill>{sample.grade}</Pill>}
            <span className="text-stone-600">{sample.site.code}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {sample.state === SampleState.ACCESSIONED && (
            <Link href={`/admin/samples/${sample.id}/analyze`}>
              <Button>Enter analysis</Button>
            </Link>
          )}
          {(sample.state === SampleState.CRYOPRESERVED ||
            sample.state === SampleState.QC_A5_PENDING) && (
            <Link href={`/admin/samples/${sample.id}/qc-a5`}>
              <Button>QC-A5</Button>
            </Link>
          )}
          {(sample.state === SampleState.QUARANTINE ||
            sample.state === SampleState.POST_THAW_ANALYZED ||
            sample.state === SampleState.QC_A5_PENDING) && (
            <Link href={`/admin/samples/${sample.id}/post-thaw`}>
              <Button variant="outline">Post-thaw</Button>
            </Link>
          )}
          {sample.state === SampleState.VIALED && (
            <form
              action={async () => {
                "use server";
                await markCryopreserved(sample.id);
              }}
            >
              <Button type="submit">Mark cryopreserved</Button>
            </form>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-stone-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/samples/${sample.id}?tab=${t.key}`}
            className={cn(
              "rounded-t-md px-3 py-2 text-sm",
              activeTab === t.key
                ? "bg-white font-medium text-emerald-900 ring-1 ring-stone-200"
                : "text-stone-600 hover:bg-stone-100",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm space-y-4">
        {activeTab === "a0" && (
          <Dl
            rows={[
              ["Collected", `${sample.collectionDate.toISOString().slice(0, 10)} ${sample.collectionTime}`],
              ["Abstinence days", String(sample.abstinenceDays)],
              ["Delivered to lab", sample.deliveredToLabAt?.toISOString() ?? "—"],
              ["QC-A1 container", yn(sample.qcA1ContainerIntact)],
              ["QC-A1 ID match", yn(sample.qcA1IdMatch)],
              ["QC-A1 <30 min", yn(sample.qcA1TimeUnder30)],
              ["QC-A1 complete", yn(sample.qcA1CompleteEjaculate)],
              ["Notes", sample.notes ?? "—"],
            ]}
          />
        )}
        {activeTab === "a1" && (
          <Dl
            rows={[
              ["Volume (mL)", n(sample.volumeML)],
              ["pH", n(sample.ph)],
              ["Viscosity", sample.viscosity ?? "—"],
              ["Concentration (M/mL)", n(sample.concentrationMPerML)],
              ["PR motility %", n(sample.progressiveMotilityPct)],
              ["Total motility %", n(sample.totalMotilityPct)],
              ["Morphology %", n(sample.morphologyNormalPct)],
              ["Vitality %", n(sample.vitalityPct)],
              ["Total motile (M)", n(sample.totalMotileSpermsMillion)],
              ["Video URL", sample.analysisVideoUrl ?? "—"],
            ]}
          />
        )}
        {activeTab === "a2" && (
          <Dl
            rows={[
              ["DFI %", n(sample.dfiPct)],
              ["MAR %", n(sample.marTestPct)],
              ["dsDNA %", n(sample.dsDnaBreakPct)],
              ["Semen culture", sample.semenCultureResult ?? "—"],
            ]}
          />
        )}
        {activeTab === "a3" && (
          <p>Decision: {sample.decisionOutcome ?? "Not recorded"}</p>
        )}
        {activeTab === "a4" && (
          <Dl
            rows={[
              ["Prep method", sample.prepMethod ?? "—"],
              ["Prepped at", sample.preppedAt?.toISOString() ?? "—"],
              ["Post-prep motility %", n(sample.postPrepMotilityPct)],
            ]}
          />
        )}
        {activeTab === "a5" && (
          <div className="space-y-2">
            <p className="font-medium">Vials ({sample.vials.length})</p>
            {sample.vials.length === 0 ? (
              <p className="text-stone-500">No vials created.</p>
            ) : (
              <ul className="list-disc pl-5">
                {sample.vials.map((v) => (
                  <li key={v.id}>
                    {v.vialCode} · {v.tank.tankCode} ·{" "}
                    {v.canisterCode}/{v.rackCode}/{v.positionCode ?? "—"}
                    {v.isQuarantined ? " · quarantine" : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {activeTab === "a6" && (
          <Dl
            rows={[
              ["Cryomedia", sample.cryomedia ?? "—"],
              ["Protocol", sample.cryoProtocol ?? "—"],
              ["Cryo date", sample.cryoDate?.toISOString() ?? "—"],
            ]}
          />
        )}
        {activeTab === "a7" && (
          <Dl
            rows={[
              ["Test vial post-thaw PR %", n(sample.testVialThawResult)],
              ["Post-thaw video", sample.postThawVideoUrl ?? "—"],
              ["QR pack", sample.qrPackUrl ?? "—"],
              ["Grade", sample.grade ?? "—"],
            ]}
          />
        )}
        {activeTab === "a8" && (
          <Dl
            rows={[
              ["Quarantine start", sample.quarantineStartDate?.toISOString() ?? "—"],
              ["Quarantine end", sample.quarantineEndDate?.toISOString() ?? "—"],
              ["Day-165 notified", sample.day165NotifiedAt?.toISOString() ?? "—"],
              ["Post-quarantine serology", yn(sample.postQuarantineSerologyPass)],
            ]}
          />
        )}
        {activeTab === "a9" && (
          <Dl
            rows={[
              ["Concentration", n(sample.postThawConcentration)],
              ["Rapid PR %", n(sample.postThawRapidPRPct)],
              ["Slow PR %", n(sample.postThawSlowPRPct)],
              ["Non-progressive %", n(sample.postThawNonProgPct)],
              ["Vitality %", n(sample.postThawVitalityPct)],
              ["Morphology %", n(sample.postThawMorphologyPct)],
              ["Volume/vial", n(sample.postThawVolumeML)],
            ]}
          />
        )}

        <PhaseActions
          sampleId={sample.id}
          state={sample.state}
          witnesses={witnesses}
        />
      </div>
    </div>
  );
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn";
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 ring-1",
        tone === "ok" && "bg-emerald-50 text-emerald-900 ring-emerald-200",
        tone === "warn" && "bg-amber-50 text-amber-900 ring-amber-200",
        tone === "neutral" && "bg-stone-100 text-stone-800 ring-stone-200",
      )}
    >
      {children}
    </span>
  );
}

function Dl({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs uppercase tracking-wide text-stone-500">{k}</dt>
          <dd className="mt-0.5 text-stone-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function n(v: number | null | undefined) {
  return v === null || v === undefined ? "—" : String(v);
}
function yn(v: boolean | null | undefined) {
  if (v === null || v === undefined) return "—";
  return v ? "Yes" : "No";
}
