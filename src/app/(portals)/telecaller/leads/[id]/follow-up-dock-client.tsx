"use client";

import { FollowUpRowCard, type FollowUpQueueRow } from "@/app/(portals)/telecaller/follow-ups/follow-up-queue-client";

export function FollowUpDockClient({
  leadId,
  items,
}: {
  leadId: string;
  items: FollowUpQueueRow[];
}) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="font-semibold">Follow-ups</h2>
      <p className="mb-3 text-xs text-stone-500">Open tasks for this lead ({leadId.slice(0, 8)}…)</p>
      {items.length === 0 ? (
        <p className="text-sm text-stone-500">No open follow-ups</p>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <FollowUpRowCard key={row.id} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}
