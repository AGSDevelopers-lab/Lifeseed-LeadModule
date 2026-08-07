"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  completeQuarantineQcA6,
  createSampleVials,
  decideSample,
  markDay165Notified,
  prepareSample,
  saveAdvancedTests,
} from "@/app/(portals)/admin/samples/actions";
import { Button, Input, Label } from "@/components/ui/primitives";

export function PhaseActions({
  sampleId,
  state,
  witnesses,
}: {
  sampleId: string;
  state: string;
  witnesses: Array<{ id: string; email: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [witnessUserId, setWitnessUserId] = useState(witnesses[0]?.id ?? "");
  const [vialCount, setVialCount] = useState("8");
  const [prepMethod, setPrepMethod] = useState("DGC");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error ?? "Failed");
        return;
      }
      toast.success(okMsg);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        Phase actions
      </p>

      {state === "ANALYZED" && (
        <Button
          disabled={pending}
          onClick={() =>
            run(
              () => saveAdvancedTests({ sampleId }),
              "Advanced testing phase opened",
            )
          }
        >
          Record advanced tests / skip to decision
        </Button>
      )}

      {(state === "ANALYZED" || state === "ADVANCED_TESTING") && (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () => decideSample({ sampleId, decisionOutcome: "PROCEED" }),
                "Proceed to preparation",
              )
            }
          >
            Decide: Proceed
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  decideSample({ sampleId, decisionOutcome: "RESCHEDULE" }),
                "Marked reschedule",
              )
            }
          >
            Reschedule
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              run(
                () => decideSample({ sampleId, decisionOutcome: "DISCARD" }),
                "Sample closed (discard)",
              )
            }
          >
            Discard
          </Button>
        </div>
      )}

      {state === "DECIDED" && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label>Prep method</Label>
            <select
              className="h-10 rounded-md border border-stone-300 px-2 text-sm"
              value={prepMethod}
              onChange={(e) => setPrepMethod(e.target.value)}
            >
              <option value="DGC">DGC</option>
              <option value="SWIM_UP">Swim-up</option>
              <option value="DIRECT_WASH">Direct wash</option>
            </select>
          </div>
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () => prepareSample({ sampleId, prepMethod }),
                "Preparation complete",
              )
            }
          >
            Complete preparation
          </Button>
        </div>
      )}

      {state === "PREPARED" && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label>Vial count</Label>
            <Input
              className="w-24"
              value={vialCount}
              onChange={(e) => setVialCount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Witness</Label>
            <select
              className="h-10 rounded-md border border-stone-300 px-2 text-sm"
              value={witnessUserId}
              onChange={(e) => setWitnessUserId(e.target.value)}
            >
              {witnesses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.email}
                </option>
              ))}
            </select>
          </div>
          <Button
            disabled={pending || !witnessUserId}
            onClick={() =>
              run(
                () =>
                  createSampleVials({
                    sampleId,
                    vialCount: Number(vialCount) || 8,
                    volumeML: 0.5,
                    witnessUserId,
                  }),
                "Vials created (2-witness)",
              )
            }
          >
            Create vials
          </Button>
        </div>
      )}

      {state === "QUARANTINE" && (
        <div className="space-y-2">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(() => markDay165Notified(sampleId), "Day-165 recall logged")
            }
          >
            Fire Day-165 donor recall
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  completeQuarantineQcA6({
                    sampleId,
                    serology: {
                      HIV_I_II: "NEG",
                      HBSAG: "NEG",
                      HCV: "NEG",
                      VDRL: "NEG",
                      HTLV: "NEG",
                      CMV_IGM: "NEG",
                    },
                  }),
                "QC-A6 passed — quarantine cleared",
              )
            }
          >
            Record Day-180 serology (all NEG)
          </Button>
        </div>
      )}
    </div>
  );
}
