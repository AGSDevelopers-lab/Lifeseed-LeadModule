import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LeadStatus, UserRole } from "@prisma/client";

import { LeadAdminActions } from "@/app/(portals)/admin/leads/[id]/lead-admin-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { loadAdminLeadDetail } from "@/lib/leads/adapters/prisma-lead-repository";
import { LeadOwnershipDeniedError } from "@/lib/leads/domain/errors";
import { getSession, permissionGranted, permissionsForRoles } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const SCORE_MAX: Record<string, number> = {
  age: 20, source: 20, language: 5, location: 10, completeness: 20, responseSpeed: 10,
};
const TIER_CLASS: Record<string, string> = {
  HOT: "bg-red-50 text-red-900 ring-red-200",
  WARM: "bg-amber-50 text-amber-900 ring-amber-200",
  COLD: "bg-sky-50 text-sky-900 ring-sky-200",
  ARCHIVED: "bg-stone-100 text-stone-600 ring-stone-200",
};

function ist(d: Date | null | undefined) {
  return d ? d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—";
}
function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function slaLabel(due: Date | null, responded: boolean) {
  if (responded) return "responded";
  if (!due) return "—";
  const ms = due.getTime() - Date.now();
  if (ms <= 0) return "overdue";
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}
function Kv({ data }: { data: Record<string, unknown> }) {
  const e = Object.entries(data);
  if (!e.length) return <p className="text-sm text-stone-500">None</p>;
  return (
    <dl className="space-y-1 text-sm">
      {e.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="min-w-[6rem] text-stone-500">{k}</dt>
          <dd className="break-all text-stone-800">
            {typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AdminLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const perms = permissionsForRoles(session.roles);
  if (!permissionGranted(perms, "lead.view")) redirect("/admin/leads");

  const { id } = await params;
  const actor = await resolveLeadActor();
  if (!actor) redirect("/login");

  let lead: Awaited<ReturnType<typeof loadAdminLeadDetail>>;
  let telecallers: Array<{ id: string; email: string }>;
  try {
    [lead, telecallers] = await Promise.all([
      loadAdminLeadDetail(id, actor),
      prisma.user.findMany({
        where: { isActive: true, roles: { some: { role: UserRole.TELECALLER } } },
        select: { id: true, email: true },
        orderBy: { email: "asc" },
        take: 100,
      }),
    ]);
  } catch (err) {
    if (err instanceof LeadOwnershipDeniedError) notFound();
    throw err;
  }
  if (!lead) notFound();

  const meta = asRec(lead.sourceMetadata);
  const utm = Object.fromEntries(Object.entries(meta).filter(([k]) => k.toLowerCase().startsWith("utm")));
  const other = Object.fromEntries(Object.entries(meta).filter(([k]) => !k.toLowerCase().startsWith("utm")));
  const breakdown = asRec(lead.scoreBreakdown);
  const consentOk = lead.consentMarketing && lead.consentScreening && lead.consentDataProcessing;
  const responded =
    lead.callDispositions.length > 0 ||
    (lead.status !== LeadStatus.NEW && lead.status !== LeadStatus.ASSIGNED);
  const mark = (ok: boolean) => (
    <span className={ok ? "text-emerald-700" : "text-red-600"}>{ok ? "✓" : "✗"}</span>
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/leads" className="text-sm text-emerald-900 hover:underline">← Leads</Link>
        <h1 className="mt-2 text-2xl font-semibold">{lead.leadCode}</h1>
        <p className="text-stone-700">{lead.fullName ?? "—"}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1", TIER_CLASS[lead.tier] ?? TIER_CLASS.COLD)}>
            Tier at capture · {lead.tier}
          </span>
          <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium ring-1 ring-stone-200">
            {lead.status}
          </span>
          <span className="text-sm font-medium">Score {lead.score}</span>
        </div>
        <p className="mt-2 text-xs">
          <Link href={`/telecaller/leads/${lead.id}`} className="text-emerald-900 hover:underline">
            Open telecaller view
          </Link>
        </p>
        {lead.convertedDonor && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            CONVERTED → Donor{" "}
            <Link href={`/admin/donors/${lead.convertedDonor.id}`} className="font-semibold underline">
              {lead.convertedDonor.donorCode}
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Phone: {lead.phoneCountryCode} {lead.phone ?? "—"}</p>
            <p>Email: {lead.email ?? "—"}</p>
            <p>Location: {[lead.city, lead.state, lead.pincode].filter(Boolean).join(", ") || "—"}</p>
            <p>Language: {lead.preferredLanguage ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Source &amp; Timing</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Source: {lead.source}</p>
            <p>Captured: {ist(lead.capturedAt)}</p>
            <p className="font-medium text-stone-700">Metadata</p>
            <Kv data={other} />
            <p className="font-medium text-stone-700">UTM</p>
            <Kv data={utm} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Consent (DPDP)</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Marketing {mark(lead.consentMarketing)}</p>
            <p>Screening {mark(lead.consentScreening)}</p>
            <p>Processing {mark(lead.consentDataProcessing)}</p>
            <p>Version: {lead.consentVersion ?? "—"}</p>
            <p>IP: {lead.consentIp ?? "—"}</p>
            <p className="break-all">UA: {lead.consentUserAgent ?? "—"}</p>
            <p>Captured: {ist(lead.capturedAt)}</p>
            {!consentOk && (
              <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
                One or more consents are FALSE
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score {lead.score} · {lead.tier}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.keys(SCORE_MAX).map((key) => {
            const val = Number(breakdown[key] ?? 0);
            const max = SCORE_MAX[key];
            return (
              <div key={key}>
                <div className="mb-1 flex justify-between text-xs text-stone-600">
                  <span className="capitalize">{key}</span>
                  <span>{val}/{max}</span>
                </div>
                <div className="h-2 rounded-full bg-stone-100">
                  <div className="h-2 rounded-full bg-emerald-700" style={{ width: `${Math.min(100, Math.round((val / max) * 100))}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Assignment &amp; SLA</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            Telecaller:{" "}
            {lead.assignedTelecaller ? (
              <Link href="/telecaller/queue" className="text-emerald-900 hover:underline">
                {lead.assignedTelecaller.email}
              </Link>
            ) : "unassigned"}
          </p>
          <p>Assigned at: {ist(lead.assignedAt)}</p>
          <p>SLA response due: {ist(lead.slaResponseDueAt)} ({slaLabel(lead.slaResponseDueAt, responded)})</p>
          <p>SLA qualify due: {ist(lead.slaQualifyDueAt)}</p>
          <p>Last activity: {ist(lead.lastActivityAt)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Call history</CardTitle></CardHeader>
        <CardContent>
          {lead.callDispositions.length === 0 ? (
            <p className="text-sm text-stone-500">No calls logged yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dispositioned at</TableHead>
                  <TableHead>Disposition</TableHead>
                  <TableHead>Telecaller</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lead.callDispositions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{ist(c.createdAt)}</TableCell>
                    <TableCell>{c.disposition}</TableCell>
                    <TableCell>{c.telecaller.email}</TableCell>
                    <TableCell>{c.durationSeconds != null ? `${c.durationSeconds}s` : "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{c.notes ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Counselling booking</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {!lead.counsellingBooking ? (
            <p className="text-stone-500">No counselling booked</p>
          ) : (
            <div className="space-y-1">
              <p>Scheduled: {ist(lead.counsellingBooking.scheduledAt)}</p>
              <p>Mode: {lead.counsellingBooking.mode}</p>
              <p>Counsellor: {lead.counsellingBooking.counsellor.email}</p>
              <p>Status: {lead.counsellingBooking.status}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <LeadAdminActions
        leadId={lead.id}
        phone={lead.phone}
        email={lead.email}
        telecallers={telecallers}
        canAssign={permissionGranted(perms, "lead.assign")}
        canDnc={permissionGranted(perms, "dnc.add")}
        canArchive={permissionGranted(perms, "lead.archive")}
        canPurge={permissionGranted(perms, "lead.purge")}
      />

      {!lead.convertedDonorId && lead.retentionExpiresAt && (
        <p className="text-xs text-stone-500">Auto-purge on {ist(lead.retentionExpiresAt)}</p>
      )}
    </div>
  );
}
