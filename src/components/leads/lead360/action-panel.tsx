"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/primitives";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Lead360ActionId } from "@/lib/leads/application/resolve-lead-actions";

const LABELS: Record<Lead360ActionId, string> = {
  ARCHIVE_LEAD: "Archive lead",
  RESCHEDULE_COUNSELLING: "Reschedule counselling",
  CANCEL_COUNSELLING: "Cancel counselling",
  CONVERT_TO_DONOR: "Convert to donor",
  CONVERT_TO_RECIPIENT: "Convert to recipient",
};

const TYPED: Partial<Record<Lead360ActionId, true>> = {
  ARCHIVE_LEAD: true,
  CONVERT_TO_DONOR: true,
  CONVERT_TO_RECIPIENT: true,
};

export function Lead360ActionPanel({
  leadId,
  leadCode,
  bookingId,
  available,
  archiveBlocked,
}: {
  leadId: string;
  leadCode: string;
  bookingId: string | null;
  available: Lead360ActionId[];
  archiveBlocked: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Lead360ActionId | null>(null);
  const [working, setWorking] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState("");

  async function run(id: Lead360ActionId) {
    setWorking(true);
    setError(null);
    try {
      let res: Response;
      if (id === "ARCHIVE_LEAD") {
        res = await fetch(`/api/leads/v2/leads/${leadId}/archive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Archived from Lead 360" }),
        });
      } else if (id === "CONVERT_TO_DONOR") {
        res = await fetch(`/api/leads/v2/leads/${leadId}/convert/donor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      } else if (id === "CONVERT_TO_RECIPIENT") {
        res = await fetch(`/api/leads/v2/leads/${leadId}/convert/recipient`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      } else if (id === "CANCEL_COUNSELLING") {
        if (!bookingId) throw new Error("No counselling booking");
        res = await fetch(`/api/leads/v2/counselling/bookings/${bookingId}/cancel`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Cancelled from Lead 360" }),
        });
      } else {
        if (!bookingId || !schedule) throw new Error("Scheduled time is required");
        res = await fetch(`/api/leads/v2/counselling/bookings/${bookingId}/reschedule`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduledAt: schedule }),
        });
      }
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        const msg = body.error?.message ?? `Request failed (${res.status})`;
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Saved");
      setPending(null);
      setTyped("");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setWorking(false);
    }
  }

  const needsCode = pending ? Boolean(TYPED[pending]) : false;
  const canConfirm = pending
    ? needsCode
      ? typed === leadCode
      : pending === "RESCHEDULE_COUNSELLING"
        ? Boolean(schedule)
        : true
    : false;

  return (
    <div data-testid="lead360-action-panel" className="space-y-2">
      <p className="text-sm font-medium text-stone-800">Permitted actions</p>
      {archiveBlocked && (
        <p className="text-xs text-stone-500">Archive is unavailable for terminal status.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {available.map((id) => (
          <Button key={id} variant="outline" onClick={() => { setPending(id); setError(null); setTyped(""); }}>
            {LABELS[id]}
          </Button>
        ))}
        {available.length === 0 && (
          <p className="text-sm text-stone-500">No actions available</p>
        )}
      </div>
      <Dialog open={pending != null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending ? LABELS[pending] : ""}</DialogTitle>
          </DialogHeader>
          {needsCode && (
            <label className="block text-sm text-stone-700">
              Type {leadCode} to confirm
              <input
                className="mt-1 flex h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
            </label>
          )}
          {pending === "RESCHEDULE_COUNSELLING" && (
            <label className="block text-sm text-stone-700">
              New time (ISO)
              <input
                className="mt-1 flex h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p data-testid="lead360-action-error" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogCloseButton onClick={() => setPending(null)} />
            <Button disabled={working || !canConfirm} onClick={() => pending && void run(pending)}>
              {working ? "Working…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
