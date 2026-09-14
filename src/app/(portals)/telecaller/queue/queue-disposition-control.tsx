"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CallDispositionType } from "@prisma/client";
import { toast } from "sonner";

import { saveDisposition } from "@/app/(portals)/leads/actions";
import { Button } from "@/components/ui/primitives";

export function QueueDispositionControl({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [disposition, setDisposition] = useState<CallDispositionType>(
    CallDispositionType.CONTACTED_QUALIFIED,
  );
  const [pending, setPending] = useState(false);

  async function onSave() {
    setPending(true);
    const result = await saveDisposition({
      leadId,
      disposition,
      callStartedAt: new Date(Date.now() - 60_000).toISOString(),
      callEndedAt: new Date().toISOString(),
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Disposition saved");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <select
        className="max-w-[11rem] rounded-md border border-stone-300 px-1 py-0.5 text-xs"
        value={disposition}
        onChange={(e) => setDisposition(e.target.value as CallDispositionType)}
        aria-label="Disposition"
      >
        {Object.values(CallDispositionType).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <Button
        type="button"
        className="h-7 px-2 text-xs"
        disabled={pending}
        onClick={() => void onSave()}
      >
        Save
      </Button>
    </div>
  );
}
