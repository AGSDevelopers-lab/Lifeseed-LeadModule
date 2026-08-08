"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CycleEventType } from "@prisma/client";
import { toast } from "sonner";

import {
  Button,
  Input,
  Label,
} from "@/components/ui/primitives";
import { CYCLE_EVENT_LABEL, WITNESS_REQUIRED } from "@/lib/embryology/labels";

const EVENT_FIELDS: Partial<
  Record<
    CycleEventType,
    Array<{ key: string; label: string; type?: string; required?: boolean }>
  >
> = {
  STIM_MONITORING: [
    { key: "stimDay", label: "Stim day", type: "number", required: true },
    { key: "follicleCount", label: "Follicle count", type: "number", required: true },
    { key: "leadFollicleMm", label: "Lead follicle (mm)", type: "number" },
    { key: "e2PgMl", label: "E2 (pg/mL)", type: "number" },
    { key: "notes", label: "Notes" },
  ],
  OPU_COMPLETED: [
    { key: "folliclesAspirated", label: "Follicles aspirated", type: "number", required: true },
    { key: "oocytesRetrieved", label: "Oocytes retrieved", type: "number", required: true },
    { key: "complications", label: "Complications" },
  ],
  OOCYTES_RETRIEVED: [
    { key: "oocytesRetrieved", label: "Oocytes retrieved", type: "number", required: true },
    { key: "miiCount", label: "MII count", type: "number", required: true },
    { key: "miCount", label: "MI count", type: "number" },
    { key: "gvCount", label: "GV count", type: "number" },
  ],
  FERTILIZATION: [
    { key: "method", label: "Method (ICSI|IVF|IVF_ICSI)", required: true },
    { key: "spermSource", label: "Sperm source (DONOR_VIAL|PARTNER|MIXED)", required: true },
    { key: "oocytesInseminated", label: "Oocytes inseminated", type: "number", required: true },
  ],
  DAY1_CHECK: [
    { key: "twoPnCount", label: "2PN count", type: "number", required: true },
  ],
  DAY3_GRADE: [
    { key: "cleavedCount", label: "Cleaved count", type: "number", required: true },
  ],
  DAY5_GRADE: [
    { key: "blastCount", label: "Blast count", type: "number", required: true },
  ],
  TRANSFER: [
    { key: "embryoIds", label: "Embryo IDs (comma-separated)", required: true },
    { key: "catheterLot", label: "Catheter lot" },
    { key: "difficulty", label: "Difficulty (EASY|MODERATE|DIFFICULT)" },
  ],
  VITRIFICATION: [
    { key: "embryoIds", label: "Embryo IDs (comma-separated)", required: true },
    { key: "storageRef", label: "Storage ref" },
    { key: "device", label: "Device" },
  ],
  BETA_HCG: [
    { key: "result", label: "Result (POSITIVE|NEGATIVE|INCONCLUSIVE)", required: true },
    { key: "valueMiuMl", label: "Value (mIU/mL)", type: "number" },
  ],
  CLINICAL_PREGNANCY: [
    { key: "sacCount", label: "Sac count", type: "number" },
    { key: "fetalHeart", label: "Fetal heart (true|false)" },
    { key: "notes", label: "Notes" },
  ],
  LIVE_BIRTH: [
    { key: "births", label: "Births", type: "number" },
    { key: "gestationalAgeWeeks", label: "GA (weeks)", type: "number" },
    { key: "notes", label: "Notes" },
  ],
  CYCLE_CANCELLED: [
    { key: "reason", label: "Reason", required: true },
  ],
  PGT_RESULT: [
    {
      key: "pgtJson",
      label: 'Embryos JSON [{"oocyteId":"...","pgtResult":"EUPLOID"}]',
      required: true,
    },
  ],
};

export function LogEventForm({
  drfId,
  allowedEvents,
  witnesses,
}: {
  drfId: string;
  allowedEvents: CycleEventType[];
  witnesses: Array<{ id: string; email: string }>;
}) {
  const router = useRouter();
  const [eventType, setEventType] = useState<CycleEventType>(
    allowedEvents[0] ?? CycleEventType.STIM_MONITORING,
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [witnessUserId, setWitnessUserId] = useState(witnesses[0]?.id ?? "");
  const [loading, setLoading] = useState(false);

  const fields = useMemo(() => EVENT_FIELDS[eventType] ?? [], [eventType]);
  const needsWitness = WITNESS_REQUIRED.includes(eventType);

  function setField(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function buildPayload(): unknown {
    if (eventType === CycleEventType.PGT_RESULT) {
      return { embryos: JSON.parse(values.pgtJson || "[]") };
    }
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = values[f.key];
      if (raw == null || raw === "") continue;
      if (f.key === "embryoIds") {
        payload.embryoIds = raw.split(",").map((s) => s.trim()).filter(Boolean);
        continue;
      }
      if (f.key === "fetalHeart") {
        payload.fetalHeart = raw.toLowerCase() === "true";
        continue;
      }
      if (f.type === "number") {
        payload[f.key] = Number(raw);
        continue;
      }
      payload[f.key] = raw;
    }
    return payload;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = buildPayload();
      const res = await fetch(`/api/embryology/cycles/${drfId}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType,
          payload,
          witnessUserId: needsWitness ? witnessUserId : undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to log event");
        return;
      }
      toast.success("Event logged");
      router.push(`/clinic/cycles/${drfId}`);
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-stone-200 bg-white p-6">
      <div className="space-y-2">
        <Label htmlFor="eventType">Event type</Label>
        <select
          id="eventType"
          className="flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
          value={eventType}
          onChange={(e) => {
            setEventType(e.target.value as CycleEventType);
            setValues({});
          }}
        >
          {allowedEvents.map((t) => (
            <option key={t} value={t}>
              {CYCLE_EVENT_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      {fields.map((f) => (
        <div key={f.key} className="space-y-2">
          <Label htmlFor={f.key}>{f.label}</Label>
          <Input
            id={f.key}
            type={f.type === "number" ? "number" : "text"}
            required={f.required}
            value={values[f.key] ?? ""}
            onChange={(e) => setField(f.key, e.target.value)}
          />
        </div>
      ))}

      {needsWitness && (
        <div className="space-y-2">
          <Label htmlFor="witness">2nd witness</Label>
          <select
            id="witness"
            className="flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
            value={witnessUserId}
            onChange={(e) => setWitnessUserId(e.target.value)}
            required
          >
            {witnesses.length === 0 && (
              <option value="">No clinic witnesses configured</option>
            )}
            {witnesses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.email}
              </option>
            ))}
          </select>
        </div>
      )}

      <Button type="submit" disabled={loading || (needsWitness && !witnessUserId)}>
        {loading ? "Saving…" : "Submit event"}
      </Button>
    </form>
  );
}
