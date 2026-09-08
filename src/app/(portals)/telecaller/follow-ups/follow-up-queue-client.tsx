"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  completeFollowUpAction,
  rescheduleFollowUpAction,
} from "@/app/(portals)/telecaller/follow-ups/actions";
import { Button, Input } from "@/components/ui/primitives";

export type FollowUpQueueRow = {
  id: string;
  leadId: string;
  leadCode?: string;
  type: string;
  priority: string;
  reason: string | null;
  dueAt: string;
  status: string;
};

function formatIst(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

export function FollowUpQueueClient({
  dueToday,
  overdue,
  next7,
}: {
  dueToday: FollowUpQueueRow[];
  overdue: FollowUpQueueRow[];
  next7: FollowUpQueueRow[];
}) {
  return (
    <div className="space-y-8">
      <Section title="Overdue" rows={overdue} tone="danger" />
      <Section title="Due today" rows={dueToday} tone="warn" />
      <Section title="Next 7 days" rows={next7} tone="neutral" />
    </div>
  );
}

function Section({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: FollowUpQueueRow[];
  tone: "danger" | "warn" | "neutral";
}) {
  const border =
    tone === "danger"
      ? "border-red-200"
      : tone === "warn"
        ? "border-amber-200"
        : "border-stone-200";
  return (
    <section className={`rounded-xl border bg-white p-4 ${border}`}>
      <h2 className="mb-3 font-semibold">
        {title}{" "}
        <span className="text-sm font-normal text-stone-500">({rows.length})</span>
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-500">None</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <FollowUpRowCard key={row.id} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function FollowUpRowCard({ row }: { row: FollowUpQueueRow }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [pending, setPending] = useState(false);

  async function onComplete() {
    setPending(true);
    const result = await completeFollowUpAction({ id: row.id, outcome: outcome || undefined });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Follow-up completed");
    router.refresh();
  }

  async function onReschedule() {
    if (!dueAt) {
      toast.error("Pick a new due time");
      return;
    }
    setPending(true);
    const result = await rescheduleFollowUpAction({ id: row.id, dueAt });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Follow-up rescheduled");
    router.refresh();
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border border-stone-100 bg-stone-50 p-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-medium">
          {row.leadCode ?? row.leadId} · {row.type} · {row.priority}
        </p>
        <p className="text-xs text-stone-600">
          {row.status} · due {formatIst(row.dueAt)} IST
        </p>
        {row.reason && <p className="mt-1 text-xs text-stone-500">{row.reason}</p>}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Input
          className="h-9 w-40 text-xs"
          placeholder="Outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
        />
        <Button disabled={pending} onClick={() => void onComplete()}>
          Complete
        </Button>
        <Input
          className="h-9 w-44 text-xs"
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => void onReschedule()}
        >
          Reschedule
        </Button>
      </div>
    </li>
  );
}
