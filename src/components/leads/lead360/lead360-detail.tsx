import Link from "next/link";
import { LeadStatus } from "@prisma/client";

import { LeadAdminActions } from "@/app/(portals)/admin/leads/[id]/lead-admin-actions";
import { Lead360ActionPanel } from "@/components/leads/lead360/action-panel";
import { Lead360AsyncPanels } from "@/components/leads/lead360/async-panels";
import {
  LeadArchiveBadge,
  LeadOutcomeBadge,
  LeadStatusBadge,
  LeadTierBadge,
} from "@/components/leads/lead360/semantic-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import type { AdminLeadDetail } from "@/lib/leads/adapters/prisma-lead-repository";
import type { Lead360ActionId } from "@/lib/leads/application/resolve-lead-actions";
import { permissionGranted } from "@/lib/rbac";
import type { Permission } from "@/lib/rbac-permissions";

const TERMINAL: readonly string[] = ["LOST", "CONVERTED", "EXPIRED_AUTO_PURGED"];

function ist(d: Date | null | undefined) {
  return d ? d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—";
}

export function Lead360Detail({
  lead,
  telecallers,
  perms,
  actions,
}: {
  lead: AdminLeadDetail;
  telecallers: Array<{ id: string; email: string }>;
  perms: Permission[];
  actions: Lead360ActionId[];
}) {
  const archiveBlocked = TERMINAL.includes(lead.status);
  const openBooking =
    lead.counsellingBookings.find((b) => b.bookingStatus === "SCHEDULED") ??
    lead.counsellingBookings[0];

  return (
    <div className="space-y-6" data-testid="lead360-surface">
      <div>
        <Link href="/admin/leads" className="text-sm text-emerald-900 hover:underline">
          ← Leads
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{lead.leadCode}</h1>
        <p className="text-stone-700">{lead.fullName ?? "—"}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <LeadTierBadge tier={lead.tier} />
          <LeadStatusBadge status={lead.status} />
          <LeadOutcomeBadge outcome={lead.outcome} />
          <LeadArchiveBadge isArchived={lead.isArchived} archiveBlocked={archiveBlocked} />
          <span className="text-sm font-medium">Score {lead.score}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Person type: {lead.personType}</p>
            <p>Phone: {lead.phoneCountryCode} {lead.phone ?? "—"}</p>
            <p>Email: {lead.email ?? "—"}</p>
            <p>Location: {[lead.city, lead.state, lead.pincode].filter(Boolean).join(", ") || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Counselling</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {!lead.counsellingBookings.length ? (
              <p data-testid="lead360-counselling-empty" className="text-stone-500">
                No counselling booked
              </p>
            ) : (
              lead.counsellingBookings.map((b) => (
                <div key={b.id} className="mb-2">
                  <p>Scheduled: {ist(b.scheduledAt)}</p>
                  <p>Counsellor: {b.counsellor.email}</p>
                  <p>Status: {b.bookingStatus}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Marketing: {lead.consentMarketing ? "yes" : "no"}</p>
            <p>Screening: {lead.consentScreening ? "yes" : "no"}</p>
            <p>Processing: {lead.consentDataProcessing ? "yes" : "no"}</p>
          </CardContent>
        </Card>
      </div>

      <Lead360ActionPanel
        leadId={lead.id}
        leadCode={lead.leadCode}
        bookingId={openBooking?.id ?? null}
        available={actions}
        archiveBlocked={archiveBlocked}
      />

      <Lead360AsyncPanels leadId={lead.id} />

      <LeadAdminActions
        leadId={lead.id}
        phone={lead.phone}
        email={lead.email}
        telecallers={telecallers}
        canAssign={permissionGranted(perms, "lead.assign")}
        canDnc={permissionGranted(perms, "dnc.add")}
        canArchive={false}
        canPurge={permissionGranted(perms, "lead.purge")}
      />

      {lead.status === LeadStatus.CONVERTED && lead.convertedDonor && (
        <p className="text-sm text-emerald-900">
          Converted donor{" "}
          <Link className="underline" href={`/admin/donors/${lead.convertedDonor.id}`}>
            {lead.convertedDonor.donorCode}
          </Link>
        </p>
      )}
    </div>
  );
}
