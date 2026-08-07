"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  markDispatchDelivered,
  updateDispatchTracking,
} from "@/app/(portals)/admin/drfs/actions";
import { Button, Input, Label } from "@/components/ui/primitives";

export function DispatchActions({
  dispatchId,
  state,
  courierVendor,
  courierTrackingId,
  witnesses,
  canUpdate,
  canDeliver,
}: {
  dispatchId: string;
  state: string;
  courierVendor: string | null;
  courierTrackingId: string | null;
  witnesses: Array<{ id: string; email: string }>;
  canUpdate: boolean;
  canDeliver: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [vendor, setVendor] = useState(courierVendor ?? "");
  const [tracking, setTracking] = useState(courierTrackingId ?? "");
  const [witnessUserId, setWitnessUserId] = useState(witnesses[0]?.id ?? "");

  return (
    <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
      {canUpdate && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Tracking</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Courier</Label>
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tracking number</Label>
              <Input
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
              />
            </div>
          </div>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await updateDispatchTracking({
                  dispatchId,
                  courierVendor: vendor,
                  courierTrackingId: tracking,
                });
                if (!r.ok) toast.error(r.error);
                else {
                  toast.success("Tracking updated");
                  router.refresh();
                }
              })
            }
          >
            Save tracking
          </Button>
        </div>
      )}

      {canDeliver && state === "IN_TRANSIT" && (
        <div className="space-y-2 border-t border-stone-100 pt-4">
          <Label>Witness (delivery receipt)</Label>
          <select
            className="h-10 w-full max-w-md rounded-md border border-stone-300 px-2 text-sm"
            value={witnessUserId}
            onChange={(e) => setWitnessUserId(e.target.value)}
          >
            {witnesses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.email}
              </option>
            ))}
          </select>
          <Button
            disabled={pending || !witnessUserId}
            onClick={() =>
              start(async () => {
                const r = await markDispatchDelivered({
                  dispatchId,
                  witnessUserId,
                });
                if (!r.ok) toast.error(r.error);
                else {
                  toast.success("Delivered — invoice raised");
                  router.refresh();
                }
              })
            }
          >
            Mark delivered
          </Button>
        </div>
      )}
    </div>
  );
}
