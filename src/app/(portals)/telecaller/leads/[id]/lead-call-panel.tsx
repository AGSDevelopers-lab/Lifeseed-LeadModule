"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CallDispositionType, LeadPersonType } from "@prisma/client";
import { toast } from "sonner";

import {
  convertDonorAction,
  convertRecipientAction,
  saveDisposition,
} from "@/app/(portals)/leads/actions";
import { Button, Input, Label } from "@/components/ui/primitives";

/** Mutations call server actions that load the lead via LeadRepository.byId (IDOR closed). */

export function LeadCallPanel({
  leadId,
  personType,
  canConvert,
  sites,
  clinics,
  coordinators = [],
}: {
  leadId: string;
  personType: LeadPersonType;
  canConvert: boolean;
  sites: Array<{ id: string; code: string; name: string }>;
  clinics: Array<{ id: string; name: string; clinicCode: string }>;
  coordinators?: Array<{ id: string; email: string }>;
}) {
  const router = useRouter();
  const [disposition, setDisposition] = useState<CallDispositionType>(
    CallDispositionType.CONTACTED_QUALIFIED,
  );
  const [notes, setNotes] = useState("");
  const [followupAt, setFollowupAt] = useState("");
  const [pending, setPending] = useState(false);

  // Convert extras (Aadhaar deferred to P1 screening — DPDP)
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<"M" | "F" | "O">("M");
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [preferredIntakeAt, setPreferredIntakeAt] = useState("");
  const [coordinatorUserId, setCoordinatorUserId] = useState("");
  const [clinicId, setClinicId] = useState(clinics[0]?.id ?? "");

  async function onSaveDisposition() {
    setPending(true);
    const result = await saveDisposition({
      leadId,
      disposition,
      notes,
      followupAt: followupAt || undefined,
      callStartedAt: new Date(Date.now() - 60_000).toISOString(),
      callEndedAt: new Date().toISOString(),
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Disposition saved");
    router.refresh();
  }

  async function onConvertDonor() {
    setPending(true);
    const result = await convertDonorAction(leadId, {
      dob,
      gender,
      siteId,
      preferredIntakeAt: preferredIntakeAt || undefined,
      coordinatorUserId: coordinatorUserId || undefined,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Converted to donor (P0 Intake — Aadhaar at screening)");
    router.refresh();
  }

  async function onConvertRecipient() {
    setPending(true);
    const result = await convertRecipientAction(leadId, clinicId);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Converted to recipient");
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="font-semibold">Post-call disposition</h2>
      <div className="space-y-2">
        <Label>Disposition</Label>
        <select
          className="flex h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
          value={disposition}
          onChange={(e) =>
            setDisposition(e.target.value as CallDispositionType)
          }
        >
          {Object.values(CallDispositionType).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <textarea
          className="min-h-20 w-full rounded-md border border-stone-300 p-2 text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {disposition === CallDispositionType.CONTACTED_CALLBACK_REQUESTED && (
        <div className="space-y-2">
          <Label>Follow-up at</Label>
          <Input
            type="datetime-local"
            value={followupAt}
            onChange={(e) => setFollowupAt(e.target.value)}
          />
        </div>
      )}
      <Button disabled={pending} onClick={onSaveDisposition}>
        Save disposition
      </Button>

      {canConvert && personType === LeadPersonType.DONOR && (
        <div className="space-y-3 border-t border-stone-200 pt-4">
          <h3 className="font-medium">Convert to Donor</h3>
          <p className="text-xs text-stone-500">
            Creates donor at P0_INTAKE via createDonorIntake. Aadhaar is
            collected later at full intake screening (STAGE_2 consent).
          </p>
          <div className="space-y-2">
            <Label>Date of birth</Label>
            <Input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Gender</Label>
            <select
              className="flex h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
              value={gender}
              onChange={(e) => setGender(e.target.value as "M" | "F" | "O")}
            >
              <option value="M">M</option>
              <option value="F">F</option>
              <option value="O">O</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Site</Label>
            <select
              className="flex h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Preferred intake appointment (optional)</Label>
            <Input
              type="date"
              value={preferredIntakeAt}
              onChange={(e) => setPreferredIntakeAt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Assign coordinator (optional)</Label>
            <select
              className="flex h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
              value={coordinatorUserId}
              onChange={(e) => setCoordinatorUserId(e.target.value)}
            >
              <option value="">— Unassigned —</option>
              {coordinators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.email}
                </option>
              ))}
            </select>
          </div>
          <Button disabled={pending || !dob || !siteId} onClick={onConvertDonor}>
            Convert to Donor
          </Button>
        </div>
      )}

      {canConvert && personType === LeadPersonType.RECIPIENT && (
        <div className="space-y-3 border-t border-stone-200 pt-4">
          <h3 className="font-medium">Convert to Recipient</h3>
          <select
            className="flex h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
            value={clinicId}
            onChange={(e) => setClinicId(e.target.value)}
          >
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.clinicCode} — {c.name}
              </option>
            ))}
          </select>
          <Button
            disabled={pending || !clinicId}
            onClick={onConvertRecipient}
          >
            Convert to Recipient
          </Button>
        </div>
      )}
    </div>
  );
}
