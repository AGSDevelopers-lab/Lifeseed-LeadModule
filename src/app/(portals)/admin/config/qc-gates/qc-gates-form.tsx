"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { saveQcGate } from "@/app/(portals)/admin/config/actions";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from "@/components/ui/primitives";
import type { QcGateConfigView, QcGateName } from "@/lib/qc-config";

const GATE_LABELS: Record<string, string> = {
  QC_A1: "QC-A1 · Accession integrity",
  QC_A2: "QC-A2 · WHO 6th baseline",
  QC_A3: "QC-A3 · Post-preparation",
  QC_A4: "QC-A4 · Pre-cryo aliquot",
  QC_A5: "QC-A5 · 24hr post-freeze",
  QC_A6: "QC-A6 · Day-180 serology (ICMR statutory)",
  POST_THAW_CONC: "Post-thaw · Concentration",
  POST_THAW_RAPID_PR: "Post-thaw · Rapid PR %",
  POST_THAW_SLOW_PR: "Post-thaw · Slow PR %",
  POST_THAW_NON_PROG: "Post-thaw · Non-progressive %",
  POST_THAW_VITALITY: "Post-thaw · Vitality",
  POST_THAW_MORPHOLOGY: "Post-thaw · Morphology",
  POST_THAW_VOLUME: "Post-thaw · Volume",
};

type Props = {
  siteId: string;
  gates: QcGateConfigView[];
};

export function QcGatesForm({ siteId, gates }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(
    gates.map((g) => ({
      ...g,
      thresholdText: g.thresholdOverrides
        ? JSON.stringify(g.thresholdOverrides, null, 2)
        : "",
    })),
  );
  const [saving, setSaving] = useState<string | null>(null);

  async function saveOne(gateName: QcGateName) {
    const row = rows.find((r) => r.gateName === gateName);
    if (!row) return;
    setSaving(gateName);
    try {
      const result = await saveQcGate({
        siteId,
        gateName,
        isEnabled: row.isEnabled,
        thresholdOverridesJson: row.thresholdText || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${GATE_LABELS[gateName] ?? gateName} saved`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const statutory = row.statutory || row.gateName === "QC_A6";
        return (
          <Card key={row.gateName}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {GATE_LABELS[row.gateName] ?? row.gateName}
              </CardTitle>
              <CardDescription>
                {statutory
                  ? "Non-toggleable — ICMR statutory requirement"
                  : "Admin-toggleable for this site"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label
                className={`flex items-center gap-3 text-sm ${
                  statutory ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-800"
                  checked={statutory ? true : row.isEnabled}
                  disabled={statutory}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r) =>
                        r.gateName === row.gateName
                          ? { ...r, isEnabled: e.target.checked }
                          : r,
                      ),
                    )
                  }
                />
                Gate enabled
              </label>
              <div className="space-y-1.5">
                <Label>Threshold overrides (JSON)</Label>
                <textarea
                  className="min-h-[88px] w-full rounded-md border border-stone-300 bg-white p-2 font-mono text-xs"
                  value={row.thresholdText}
                  placeholder='e.g. {"volumeMin":1.5,"prMin":40}'
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r) =>
                        r.gateName === row.gateName
                          ? { ...r, thresholdText: e.target.value }
                          : r,
                      ),
                    )
                  }
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={saving === row.gateName}
                  onClick={() => saveOne(row.gateName)}
                >
                  {saving === row.gateName ? "Saving…" : "Save gate"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
