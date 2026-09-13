"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { markCounsellingSession } from "@/app/(portals)/leads/actions";
import { Button } from "@/components/ui/primitives";

export function SessionActions({
  bookingId,
  status,
}: {
  bookingId: string;
  status: string;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  async function mark(which: "ATTENDED" | "NO_SHOW") {
    setPending(true);
    const result = await markCounsellingSession(bookingId, which, notes);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(which === "ATTENDED" ? "Marked attended" : "Marked no-show");
    router.refresh();
  }

  if (status !== "BOOKED" && status !== "SCHEDULED") {
    return (
      <p className="text-sm text-stone-500">Session already {status}</p>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
      <textarea
        className="min-h-24 w-full rounded-md border border-stone-300 p-2 text-sm"
        placeholder="Consultation notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => mark("ATTENDED")}>
          Mark Attended
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => mark("NO_SHOW")}
        >
          Mark No-Show
        </Button>
      </div>
      <p className="text-xs text-stone-500">
        Attended advances lead to COUNSELLING_ATTENDED (registration ready).
      </p>
    </div>
  );
}
