"use client";

import {
  SamplePriority,
  SampleReleaseTiming,
} from "@prisma/client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { accessionSample } from "@/app/(portals)/admin/samples/actions";
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

const schema = z.object({
  donorId: z.string().min(1, "Select a donor"),
  siteId: z.string().min(1),
  priority: z.nativeEnum(SamplePriority),
  releaseTiming: z.nativeEnum(SampleReleaseTiming),
  collectionDate: z.string().min(1),
  collectionTime: z.string().min(1),
  abstinenceDays: z.number().int().min(2).max(7),
  deliveredToLabAt: z.string().optional(),
  containerIntact: z.boolean(),
  idMatch: z.boolean(),
  timeUnder30min: z.boolean(),
  completeEjaculate: z.boolean(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type DonorOption = {
  id: string;
  donorCode: string;
  fullName: string;
  siteId: string;
  type: string;
};

export function AccessionForm({ donors }: { donors: DonorOption[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return donors.slice(0, 20);
    return donors
      .filter(
        (d) =>
          d.fullName.toLowerCase().includes(term) ||
          d.donorCode.toLowerCase().includes(term),
      )
      .slice(0, 20);
  }, [donors, q]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      donorId: "",
      siteId: donors[0]?.siteId ?? "",
      priority: SamplePriority.REGULAR,
      releaseTiming: SampleReleaseTiming.QUARANTINE,
      collectionDate: new Date().toISOString().slice(0, 10),
      collectionTime: "09:00",
      abstinenceDays: 3,
      deliveredToLabAt: "",
      containerIntact: false,
      idMatch: false,
      timeUnder30min: false,
      completeEjaculate: false,
      notes: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const donor = donors.find((d) => d.id === values.donorId);
      const result = await accessionSample({
        ...values,
        siteId: donor?.siteId ?? values.siteId,
        abstinenceDays: Number(values.abstinenceDays),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Sample accessioned");
      router.push(`/admin/samples/${result.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Accession failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>A0 · Sample accessioning</CardTitle>
        <CardDescription>
          Capture donor, case flags, collection metadata, and QC-A1 handoff
          checks. Quarantine is the default release timing for donor semen (ICMR).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label>Donor search</Label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type name or donor code"
            />
            <select
              className="flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
              {...form.register("donorId")}
            >
              <option value="">Select donor…</option>
              {filtered.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.donorCode} — {d.fullName} ({d.type})
                </option>
              ))}
            </select>
            {form.formState.errors.donorId && (
              <p className="text-xs text-red-600">
                {form.formState.errors.donorId.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Priority (SLA)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
                {...form.register("priority")}
              >
                <option value={SamplePriority.REGULAR}>REGULAR</option>
                <option value={SamplePriority.URGENT}>URGENT</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Release timing</Label>
              <select
                className="flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
                {...form.register("releaseTiming")}
              >
                <option value={SampleReleaseTiming.QUARANTINE}>
                  QUARANTINE (default)
                </option>
                <option value={SampleReleaseTiming.REGULAR}>REGULAR</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Collection date</Label>
              <Input type="date" {...form.register("collectionDate")} />
            </div>
            <div className="space-y-1.5">
              <Label>Collection time (HH:MM)</Label>
              <Input {...form.register("collectionTime")} />
            </div>
            <div className="space-y-1.5">
              <Label>Abstinence days (2–7)</Label>
              <Input
                type="number"
                {...form.register("abstinenceDays", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Delivered to lab at</Label>
              <Input
                type="datetime-local"
                {...form.register("deliveredToLabAt")}
              />
            </div>
          </div>

          <fieldset className="space-y-2 rounded-md border border-stone-200 p-4">
            <legend className="px-1 text-sm font-medium text-stone-800">
              QC-A1 · Sample handoff
            </legend>
            {(
              [
                ["containerIntact", "Container integrity intact"],
                ["idMatch", "Identity match verified"],
                ["timeUnder30min", "Time from collection under 30 minutes"],
                ["completeEjaculate", "Complete ejaculate received"],
              ] as const
            ).map(([name, label]) => (
              <label
                key={name}
                className="flex items-center gap-2 text-sm text-stone-700"
              >
                <input type="checkbox" {...form.register(name)} />
                {label}
              </label>
            ))}
          </fieldset>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              className="min-h-20 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              {...form.register("notes")}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/samples")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Accession sample"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
