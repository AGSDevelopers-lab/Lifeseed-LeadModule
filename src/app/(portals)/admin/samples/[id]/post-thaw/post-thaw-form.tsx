"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { submitPostThaw } from "@/app/(portals)/admin/samples/actions";
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
import type { QcGateName } from "@/lib/qc-config";

type GateFlag = { gateName: QcGateName; isEnabled: boolean };

export function PostThawForm({
  sampleId,
  gates,
}: {
  sampleId: string;
  gates: GateFlag[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const enabled = useMemo(
    () => new Set(gates.filter((g) => g.isEnabled).map((g) => g.gateName)),
    [gates],
  );

  const [conc, setConc] = useState("");
  const [rapid, setRapid] = useState("");
  const [slow, setSlow] = useState("");
  const [nonProg, setNonProg] = useState("");
  const [vitality, setVitality] = useState("");
  const [morph, setMorph] = useState("");
  const [volume, setVolume] = useState("0.5");

  const concN = Number(conc) || 0;
  const volN = Number(volume) || 0;
  const rapidN = Number(rapid) || 0;
  const slowN = Number(slow) || 0;
  const nonProgN = Number(nonProg) || 0;
  const totalSperm = concN * volN;
  const progressive = rapidN + slowN;
  const totalMot = progressive + nonProgN;
  const immotile = Math.max(0, 100 - totalMot);
  const totalRapidMotile = (totalSperm * rapidN) / 100;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await submitPostThaw({
        sampleId,
        postThawConcentration: enabled.has("POST_THAW_CONC")
          ? Number(conc)
          : undefined,
        postThawRapidPRPct: enabled.has("POST_THAW_RAPID_PR")
          ? Number(rapid)
          : undefined,
        postThawSlowPRPct: enabled.has("POST_THAW_SLOW_PR")
          ? Number(slow)
          : undefined,
        postThawNonProgPct: enabled.has("POST_THAW_NON_PROG")
          ? Number(nonProg)
          : undefined,
        postThawVitalityPct: enabled.has("POST_THAW_VITALITY")
          ? Number(vitality)
          : undefined,
        postThawMorphologyPct: enabled.has("POST_THAW_MORPHOLOGY")
          ? Number(morph)
          : undefined,
        postThawVolumeML: enabled.has("POST_THAW_VOLUME")
          ? Number(volume)
          : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Post-thaw analysis saved");
      router.push(`/admin/samples/${sampleId}?tab=a9`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>A9 · Post-thaw analysis (9 parameters)</CardTitle>
        <CardDescription>
          Only site-enabled fields are shown. Derived totals are read-only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          {enabled.has("POST_THAW_CONC") && (
            <Field label="1. Concentration (M/mL)" value={conc} onChange={setConc} />
          )}
          {enabled.has("POST_THAW_VOLUME") && (
            <Field label="Volume per vial (mL)" value={volume} onChange={setVolume} />
          )}
          <Readonly label="2. Total sperms in vial" value={totalSperm} />
          {enabled.has("POST_THAW_RAPID_PR") && (
            <Field label="3. Rapid progressive (%)" value={rapid} onChange={setRapid} />
          )}
          {enabled.has("POST_THAW_SLOW_PR") && (
            <Field label="4. Slow progressive (%)" value={slow} onChange={setSlow} />
          )}
          <Readonly label="5. Progressive motility (%)" value={progressive} />
          {enabled.has("POST_THAW_NON_PROG") && (
            <Field
              label="6. Non-progressive (%)"
              value={nonProg}
              onChange={setNonProg}
            />
          )}
          <Readonly label="7. Total motility (%)" value={totalMot} />
          <Readonly label="8. Immotile (%)" value={immotile} />
          <Readonly
            label="9. Total rapid motile in vial"
            value={totalRapidMotile}
          />
          {enabled.has("POST_THAW_VITALITY") && (
            <Field label="Vitality (%)" value={vitality} onChange={setVitality} />
          )}
          {enabled.has("POST_THAW_MORPHOLOGY") && (
            <Field label="Morphology (%)" value={morph} onChange={setMorph} />
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/admin/samples/${sampleId}`)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save post-thaw"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Readonly({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-stone-50 px-3 py-2 text-sm">
      {label}: <strong>{Number.isFinite(value) ? value.toFixed(2) : "—"}</strong>
    </div>
  );
}
