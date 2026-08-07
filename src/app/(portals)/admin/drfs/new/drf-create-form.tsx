"use client";

import {
  DispatchType,
  SampleCategory,
  SampleGrade,
  SamplePriority,
} from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { createDrf } from "@/app/(portals)/admin/drfs/actions";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui/primitives";

type ClinicOpt = {
  id: string;
  clinicCode: string;
  name: string;
  siteId: string;
  hasContract: boolean;
};
type SiteOpt = { id: string; code: string; name: string };

export function DrfCreateForm({
  clinics,
  sites,
  lockedClinicId,
}: {
  clinics: ClinicOpt[];
  sites: SiteOpt[];
  lockedClinicId?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const initialClinic =
    lockedClinicId ?? clinics.find((c) => c.hasContract)?.id ?? clinics[0]?.id ?? "";
  const [clinicId, setClinicId] = useState(initialClinic);
  const clinic = clinics.find((c) => c.id === clinicId);
  const [siteId, setSiteId] = useState(clinic?.siteId ?? sites[0]?.id ?? "");
  const [type, setType] = useState<DispatchType>(DispatchType.SEMEN_VIAL);
  const [priority, setPriority] = useState<SamplePriority>(SamplePriority.REGULAR);
  const [qty, setQty] = useState("1");
  const [category, setCategory] = useState("");
  const [grade, setGrade] = useState("");
  const [notes, setNotes] = useState("");
  const [expected, setExpected] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await createDrf({
        clinicId,
        siteId,
        type,
        priority,
        requestedQuantity: Number(qty) || 1,
        filterCategory: (category || null) as SampleCategory | null,
        filterGrade: (grade || null) as SampleGrade | null,
        notes: notes || undefined,
        expectedDeliveryAt: expected || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("DRF submitted");
      const base = lockedClinicId ? "/clinic/drfs" : "/admin/drfs";
      router.push(`${base}/${result.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>New DRF</CardTitle>
        <CardDescription>
          Creates in DRAFT then auto-transitions to SUBMITTED.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label>Clinic</Label>
            <select
              className="flex h-10 w-full rounded-md border border-stone-300 px-2 text-sm disabled:opacity-60"
              value={clinicId}
              disabled={Boolean(lockedClinicId)}
              onChange={(e) => {
                setClinicId(e.target.value);
                const c = clinics.find((x) => x.id === e.target.value);
                if (c) setSiteId(c.siteId);
              }}
            >
              {clinics.map((c) => (
                <option key={c.id} value={c.id} disabled={!c.hasContract}>
                  {c.clinicCode} — {c.name}
                  {!c.hasContract ? " (no contract)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Target site</Label>
            <select
              className="flex h-10 w-full rounded-md border border-stone-300 px-2 text-sm"
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select
                className="flex h-10 w-full rounded-md border border-stone-300 px-2 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value as DispatchType)}
              >
                {Object.values(DispatchType).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <select
                className="flex h-10 w-full rounded-md border border-stone-300 px-2 text-sm"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as SamplePriority)
                }
              >
                {Object.values(SamplePriority).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category filter</Label>
              <select
                className="flex h-10 w-full rounded-md border border-stone-300 px-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Any</option>
                {Object.values(SampleCategory).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Grade filter</Label>
              <select
                className="flex h-10 w-full rounded-md border border-stone-300 px-2 text-sm"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              >
                <option value="">Any</option>
                {Object.values(SampleGrade)
                  .filter((g) => g !== "REJECTED")
                  .map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Expected delivery</Label>
            <Input
              type="date"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              className="min-h-[88px] w-full rounded-md border border-stone-300 p-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push(lockedClinicId ? "/clinic/drfs" : "/admin/drfs")
              }
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !clinicId}>
              {loading ? "Submitting…" : "Submit DRF"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
