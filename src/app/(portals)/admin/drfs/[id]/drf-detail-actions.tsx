"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  acceptDrf,
  cancelDrf,
  deliverDrf,
  dispatchDrf,
  markInCycle,
  reportOutcome,
} from "@/app/(portals)/admin/drfs/actions";
import { Button, Label } from "@/components/ui/primitives";

export function DrfDetailActions({
  drfId,
  state,
  witnesses,
  canAccept,
  canAllocate,
  canDispatch,
  canDeliver,
  canCancel,
}: {
  drfId: string;
  state: string;
  witnesses: Array<{ id: string; email: string }>;
  canAccept: boolean;
  canAllocate: boolean;
  canDispatch: boolean;
  canDeliver: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [witnessUserId, setWitnessUserId] = useState(witnesses[0]?.id ?? "");
  const [outcome, setOutcome] = useState("CLINICAL_PREGNANCY");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error ?? "Failed");
        return;
      }
      toast.success(msg);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        Actions
      </p>

      {(canDispatch || canDeliver) && (
        <div className="space-y-1">
          <Label>Witness</Label>
          <select
            className="h-10 w-full max-w-sm rounded-md border border-stone-300 px-2 text-sm"
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
      )}

      <div className="flex flex-wrap gap-2">
        {state === "SUBMITTED" && canAccept && (
          <Button
            disabled={pending}
            onClick={() => run(() => acceptDrf(drfId), "DRF accepted")}
          >
            Accept
          </Button>
        )}
        {state === "ACCEPTED" && canAllocate && (
          <Button
            disabled={pending}
            onClick={() => router.push(`/admin/drfs/${drfId}/allocate`)}
          >
            Allocate vials
          </Button>
        )}
        {state === "ALLOCATED" && canDispatch && (
          <Button
            disabled={pending || !witnessUserId}
            onClick={() =>
              run(() => dispatchDrf(drfId, witnessUserId), "Dispatched")
            }
          >
            Dispatch
          </Button>
        )}
        {state === "IN_TRANSIT" && canDeliver && (
          <Button
            disabled={pending || !witnessUserId}
            onClick={() =>
              run(
                () => deliverDrf(drfId, witnessUserId),
                "Delivered — invoice raised",
              )
            }
          >
            Mark delivered
          </Button>
        )}
        {state === "DELIVERED" && (
          <Button
            disabled={pending}
            onClick={() => run(() => markInCycle(drfId), "Marked in-cycle")}
          >
            Report in-cycle
          </Button>
        )}
        {state === "IN_CYCLE" && (
          <div className="flex flex-wrap items-end gap-2">
            <select
              className="h-10 rounded-md border border-stone-300 px-2 text-sm"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              <option value="BETA_HCG_POS">Beta hCG+</option>
              <option value="CLINICAL_PREGNANCY">Clinical pregnancy</option>
              <option value="LIVE_BIRTH">Live birth</option>
              <option value="FAIL">Fail</option>
              <option value="LOSS">Loss</option>
            </select>
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () => reportOutcome(drfId, outcome),
                  "Outcome recorded — DRF closed",
                )
              }
            >
              Report outcome
            </Button>
          </div>
        )}
        {canCancel &&
          ["DRAFT", "SUBMITTED", "ACCEPTED", "ALLOCATED"].includes(state) && (
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => cancelDrf(drfId), "DRF cancelled")}
            >
              Cancel
            </Button>
          )}
      </div>
    </div>
  );
}
