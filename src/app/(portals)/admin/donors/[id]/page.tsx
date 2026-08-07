import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PhaseBadge, StatusPill } from "@/components/donor/badges";
import { Button } from "@/components/ui/primitives";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { PHASE_LABEL, REJECTION_CODE_LABEL } from "@/lib/donor-phase";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import { cn } from "@/lib/utils";
import type { DonorPhase } from "@prisma/client";

const TABS: Array<{ key: DonorPhase; hrefSuffix: string; label: string }> = [
  { key: "P0_INTAKE", hrefSuffix: "", label: "P0 Intake" },
  { key: "P1_SCREENING", hrefSuffix: "?tab=p1", label: "P1 Screening" },
  { key: "P2_ACTIVE", hrefSuffix: "?tab=p2", label: "P2 Active" },
  { key: "P3_DRF", hrefSuffix: "?tab=p3", label: "P3 DRF" },
  { key: "P4_OUTCOME", hrefSuffix: "?tab=p4", label: "P4 Outcome" },
];

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ tab?: string }>;

export default async function DonorDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!permissionGranted(permissionsForRoles(session.roles), "donor.view")) {
    redirect("/admin/donors");
  }

  const { id } = await params;
  const { tab } = await searchParams;

  const donor = await prisma.donor.findUnique({
    where: { id },
    include: {
      site: true,
      consents: { orderBy: { signedAt: "desc" } },
      labTests: { orderBy: { createdAt: "desc" } },
      samples: {
        include: { vials: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!donor) notFound();

  const drfs = await prisma.dRF.findMany({
    where: { allocatedDonorId: donor.id },
    include: { clinic: true, recipient: true },
    orderBy: { createdAt: "desc" },
  });

  const activeTab: DonorPhase =
    tab === "p1"
      ? "P1_SCREENING"
      : tab === "p2"
        ? "P2_ACTIVE"
        : tab === "p3"
          ? "P3_DRF"
          : tab === "p4"
            ? "P4_OUTCOME"
            : "P0_INTAKE";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-stone-500">{donor.donorCode}</div>
          <h1 className="text-2xl font-semibold text-stone-900">
            {donor.fullName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PhaseBadge phase={donor.phase} />
            <StatusPill status={donor.status} />
            <span className="text-sm text-stone-600">
              {donor.site.name} ({donor.site.code}) · {donor.type}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/donors/${donor.id}/consent`}>
            <Button variant="outline">Capture consent</Button>
          </Link>
          <Link href={`/admin/donors/${donor.id}/screening`}>
            <Button variant="outline">Enter serology</Button>
          </Link>
          <Link href={`/admin/donors/${donor.id}/defer`}>
            <Button variant="outline">Defer</Button>
          </Link>
          <Link href={`/admin/donors/${donor.id}/reject`}>
            <Button variant="destructive">Reject</Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-stone-200 pb-px">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/donors/${donor.id}${t.hrefSuffix}`}
            className={cn(
              "rounded-t-md px-3 py-2 text-sm",
              activeTab === t.key
                ? "bg-white font-medium text-emerald-900 ring-1 ring-stone-200 ring-b-white"
                : "text-stone-600 hover:bg-stone-100",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6">
        {activeTab === "P0_INTAKE" && <IntakeSummary donor={donor} />}
        {activeTab === "P1_SCREENING" && (
          <ScreeningSummary donor={donor} />
        )}
        {activeTab === "P2_ACTIVE" && <ActiveSummary donor={donor} />}
        {activeTab === "P3_DRF" && <DrfSummary drfs={drfs} />}
        {activeTab === "P4_OUTCOME" && <OutcomeSummary donor={donor} />}
      </div>
    </div>
  );
}

function IntakeSummary({
  donor,
}: {
  donor: {
    fullName: string;
    dob: Date;
    gender: string;
    phone: string;
    email: string | null;
    addressLine: string | null;
    city: string | null;
    stateCode: string | null;
    pincode: string | null;
    maritalStatus: string | null;
    hasLivingChild: boolean | null;
    panMasked: string | null;
    aadhaarHash: string | null;
    height: number | null;
    weight: number | null;
    bmi: number | null;
    phase: DonorPhase;
  };
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{PHASE_LABEL.P0_INTAKE}</h2>
      <dl className="grid gap-3 sm:grid-cols-2 text-sm">
        <Item label="Full name" value={donor.fullName} />
        <Item label="Date of birth" value={donor.dob.toISOString().slice(0, 10)} />
        <Item label="Gender" value={donor.gender} />
        <Item label="Phone" value={donor.phone} />
        <Item label="Email" value={donor.email ?? "—"} />
        <Item label="Marital status" value={donor.maritalStatus ?? "—"} />
        <Item
          label="Living child"
          value={
            donor.hasLivingChild === null
              ? "—"
              : donor.hasLivingChild
                ? "Yes"
                : "No"
          }
        />
        <Item label="PAN (masked)" value={donor.panMasked ?? "—"} />
        <Item
          label="Aadhaar hash"
          value={
            donor.aadhaarHash
              ? `${donor.aadhaarHash.slice(0, 12)}…`
              : "—"
          }
        />
        <Item
          label="Address"
          value={[donor.addressLine, donor.city, donor.stateCode, donor.pincode]
            .filter(Boolean)
            .join(", ") || "—"}
        />
        <Item label="Height / Weight / BMI" value={`${donor.height ?? "—"} cm / ${donor.weight ?? "—"} kg / ${donor.bmi ?? "—"}`} />
      </dl>
    </div>
  );
}

function ScreeningSummary({
  donor,
}: {
  donor: {
    id: string;
    consents: Array<{
      id: string;
      consentType: string;
      version: string;
      signedAt: Date;
      contentHash: string;
    }>;
    labTests: Array<{
      id: string;
      testCode: string;
      result: string | null;
      performedAt: Date | null;
    }>;
  };
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{PHASE_LABEL.P1_SCREENING}</h2>
        <Link href={`/admin/donors/${donor.id}/consent`}>
          <Button variant="outline">Capture STAGE_2 consent</Button>
        </Link>
      </div>
      <section>
        <h3 className="mb-2 text-sm font-medium text-stone-700">Consents</h3>
        {donor.consents.length === 0 ? (
          <p className="text-sm text-stone-500">No consent records.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Signed (UTC)</TableHead>
                <TableHead>Content hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {donor.consents.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.consentType}</TableCell>
                  <TableCell>{c.version}</TableCell>
                  <TableCell>{c.signedAt.toISOString()}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {c.contentHash.slice(0, 16)}…
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-stone-700">Lab tests</h3>
          <Link href={`/admin/donors/${donor.id}/screening`}>
            <Button variant="outline">Enter ICMR serology</Button>
          </Link>
        </div>
        {donor.labTests.length === 0 ? (
          <p className="text-sm text-stone-500">No lab results recorded.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Performed (UTC)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {donor.labTests.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.testCode}</TableCell>
                  <TableCell>{t.result ?? "—"}</TableCell>
                  <TableCell>
                    {t.performedAt?.toISOString() ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

function ActiveSummary({
  donor,
}: {
  donor: {
    passportIssuedAt: Date | null;
    bankPolicyCap: number | null;
    cumulativePregnancies: number;
    samples: Array<{
      id: string;
      sampleCode: string;
      state: string;
      category: string | null;
      vials: Array<{ id: string; isReleased: boolean; isDispensed: boolean }>;
    }>;
  };
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{PHASE_LABEL.P2_ACTIVE}</h2>
      <dl className="grid gap-3 sm:grid-cols-2 text-sm">
        <Item
          label="Donor Passport issued"
          value={
            donor.passportIssuedAt
              ? donor.passportIssuedAt.toISOString()
              : "Not issued"
          }
        />
        <Item
          label="Bank policy pregnancy cap"
          value={String(donor.bankPolicyCap ?? "—")}
        />
        <Item
          label="Cumulative pregnancies"
          value={String(donor.cumulativePregnancies)}
        />
      </dl>
      <h3 className="text-sm font-medium text-stone-700">Cryostorage summary</h3>
      {donor.samples.length === 0 ? (
        <p className="text-sm text-stone-500">
          No samples in inventory for this donor.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sample</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Vials</TableHead>
              <TableHead>Released / Dispensed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {donor.samples.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.sampleCode}</TableCell>
                <TableCell>{s.state}</TableCell>
                <TableCell>{s.category ?? "—"}</TableCell>
                <TableCell>{s.vials.length}</TableCell>
                <TableCell>
                  {s.vials.filter((v) => v.isReleased).length} /{" "}
                  {s.vials.filter((v) => v.isDispensed).length}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function DrfSummary({
  drfs,
}: {
  drfs: Array<{
    id: string;
    drfNumber: string;
    state: string;
    clinic: { name: string };
    recipient: { fullName: string };
    allocatedAt: Date | null;
  }>;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{PHASE_LABEL.P3_DRF}</h2>
      {drfs.length === 0 ? (
        <p className="text-sm text-stone-500">
          No DRFs currently allocated to this donor.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DRF</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Clinic</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Allocated (UTC)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drfs.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.drfNumber}</TableCell>
                <TableCell>{d.state}</TableCell>
                <TableCell>{d.clinic.name}</TableCell>
                <TableCell>{d.recipient.fullName}</TableCell>
                <TableCell>
                  {d.allocatedAt?.toISOString() ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function OutcomeSummary({
  donor,
}: {
  donor: {
    id: string;
    status: string;
    rejectionCode: string | null;
    outcomeNotes: string | null;
    deferredUntil: Date | null;
  };
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{PHASE_LABEL.P4_OUTCOME}</h2>
      <dl className="grid gap-3 sm:grid-cols-2 text-sm">
        <Item label="Status" value={donor.status} />
        <Item
          label="Reason code"
          value={
            donor.rejectionCode
              ? REJECTION_CODE_LABEL[
                  donor.rejectionCode as keyof typeof REJECTION_CODE_LABEL
                ] ?? donor.rejectionCode
              : "—"
          }
        />
        <Item
          label="Deferred until"
          value={donor.deferredUntil?.toISOString().slice(0, 10) ?? "—"}
        />
        <Item label="Notes" value={donor.outcomeNotes ?? "—"} />
      </dl>
      <div className="flex gap-2">
        <Link href={`/admin/donors/${donor.id}/defer`}>
          <Button variant="outline">Record deferral</Button>
        </Link>
        <Link href={`/admin/donors/${donor.id}/reject`}>
          <Button variant="destructive">Record rejection</Button>
        </Link>
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="mt-0.5 text-stone-900">{value}</dd>
    </div>
  );
}
