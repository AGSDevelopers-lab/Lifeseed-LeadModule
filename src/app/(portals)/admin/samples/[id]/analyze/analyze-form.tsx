"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { analyzeSample } from "@/app/(portals)/admin/samples/actions";
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
  volumeML: z.string().min(1),
  ph: z.string().min(1),
  viscosity: z.string().optional(),
  liquefactionTimeMin: z.string().optional(),
  concentrationMPerML: z.string().min(1),
  progressiveMotilityPct: z.string().min(1),
  totalMotilityPct: z.string().min(1),
  morphologyNormalPct: z.string().min(1),
  vitalityPct: z.string().min(1),
  analysisVideoUrl: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function AnalyzeForm({ sampleId }: { sampleId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      volumeML: "",
      ph: "",
      viscosity: "",
      liquefactionTimeMin: "",
      concentrationMPerML: "",
      progressiveMotilityPct: "",
      totalMotilityPct: "",
      morphologyNormalPct: "",
      vitalityPct: "",
      analysisVideoUrl: "",
    },
  });

  const volume = Number(form.watch("volumeML") || 0);
  const conc = Number(form.watch("concentrationMPerML") || 0);
  const totalMotile = useMemo(() => volume * conc, [volume, conc]);

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const result = await analyzeSample({
        sampleId,
        volumeML: Number(values.volumeML),
        ph: Number(values.ph),
        viscosity: values.viscosity,
        liquefactionTimeMin: values.liquefactionTimeMin
          ? Number(values.liquefactionTimeMin)
          : undefined,
        concentrationMPerML: Number(values.concentrationMPerML),
        progressiveMotilityPct: Number(values.progressiveMotilityPct),
        totalMotilityPct: Number(values.totalMotilityPct),
        morphologyNormalPct: Number(values.morphologyNormalPct),
        vitalityPct: Number(values.vitalityPct),
        analysisVideoUrl: values.analysisVideoUrl,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.passed
          ? "Analysis saved — QC-A2 passed"
          : "Analysis saved — QC-A2 failed thresholds",
      );
      router.push(`/admin/samples/${sampleId}?tab=a1`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analyze failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>A1 · Semen analysis (WHO 6th)</CardTitle>
        <CardDescription>
          Macroscopic and microscopic parameters. Total motile sperm =
          concentration × volume (auto).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {(
            [
              ["volumeML", "Volume (mL)"],
              ["ph", "pH"],
              ["viscosity", "Viscosity"],
              ["liquefactionTimeMin", "Liquefaction (min)"],
              ["concentrationMPerML", "Concentration (M/mL)"],
              ["progressiveMotilityPct", "PR motility (%)"],
              ["totalMotilityPct", "Total motility (%)"],
              ["morphologyNormalPct", "Morphology normal (%)"],
              ["vitalityPct", "Vitality (%)"],
              ["analysisVideoUrl", "Analysis video URL"],
            ] as const
          ).map(([name, label]) => (
            <div key={name} className="space-y-1.5">
              <Label>{label}</Label>
              <Input {...form.register(name)} />
            </div>
          ))}
          <div className="sm:col-span-2 rounded-md bg-stone-50 px-3 py-2 text-sm">
            Total motile sperm (M): <strong>{totalMotile || "—"}</strong>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/admin/samples/${sampleId}`)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save analysis"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
