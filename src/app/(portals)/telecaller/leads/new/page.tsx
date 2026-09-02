"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LeadDonorSubType, LeadPersonType } from "@prisma/client";
import { toast } from "sonner";

import {
  LeadConsentNotice,
  type LeadConsentValue,
} from "@/components/consent/lead-consent-notice";
import { Button, Input, Label } from "@/components/ui/primitives";

export default function NewTelecallerLeadPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [personType, setPersonType] = useState<LeadPersonType>(
    LeadPersonType.DONOR,
  );
  const [donorSubType, setDonorSubType] = useState<LeadDonorSubType>(
    LeadDonorSubType.SEMEN,
  );
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [consent, setConsent] = useState<LeadConsentValue>({
    consentMarketing: false,
    consentScreening: false,
    consentDataProcessing: true,
    preferredLanguage: "English",
    consentVersion: "lead-v1.0",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await fetch("/api/leads/intake/webhook/telecaller", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personType,
        donorSubType:
          personType === LeadPersonType.DONOR ? donorSubType : null,
        fullName,
        phone,
        email: email || null,
        city: city || null,
        preferredLanguage: consent.preferredLanguage,
        consentMarketing: consent.consentMarketing,
        consentScreening: consent.consentScreening,
        consentDataProcessing: consent.consentDataProcessing,
        consentVersion: consent.consentVersion,
      }),
    });
    const data = (await res.json()) as { error?: string; lead?: { id: string } };
    setPending(false);
    if (!res.ok) {
      toast.error(data.error ?? "Failed");
      return;
    }
    toast.success("Lead created");
    router.push(`/telecaller/leads/${data.lead?.id}`);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Add lead from call</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-stone-200 bg-white p-6">
        <div className="space-y-2">
          <Label>Person type</Label>
          <select
            className="flex h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
            value={personType}
            onChange={(e) => setPersonType(e.target.value as LeadPersonType)}
          >
            <option value="DONOR">Donor</option>
            <option value="RECIPIENT">Recipient</option>
          </select>
        </div>
        {personType === "DONOR" && (
          <div className="space-y-2">
            <Label>Donor sub-type</Label>
            <select
              className="flex h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
              value={donorSubType}
              onChange={(e) =>
                setDonorSubType(e.target.value as LeadDonorSubType)
              }
            >
              <option value="SEMEN">Semen</option>
              <option value="OOCYTE">Oocyte</option>
            </select>
          </div>
        )}
        <Input
          required
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Input
          required
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <LeadConsentNotice value={consent} onChange={setConsent} />
        <Button type="submit" disabled={pending || !consent.consentDataProcessing}>
          Create lead
        </Button>
      </form>
    </div>
  );
}
