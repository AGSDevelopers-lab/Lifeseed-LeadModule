"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { bypassSeedScoreGateAndAdvance } from "@/app/(portals)/admin/config/seedscore/actions";
import { Button, Input, Label } from "@/components/ui/primitives";

export function OverrideGateForm({ donorId }: { donorId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await bypassSeedScoreGateAndAdvance(donorId, reason);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Gate overridden · advanced to P2");
    router.push(`/admin/donors/${donorId}?tab=seedscore`);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-stone-200 bg-white p-6"
    >
      <div className="space-y-2">
        <Label htmlFor="reason">Override reason (audited)</Label>
        <Input
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          minLength={3}
        />
      </div>
      <Button type="submit" disabled={loading || reason.trim().length < 3}>
        {loading ? "Saving…" : "Bypass gate & advance to P2"}
      </Button>
    </form>
  );
}
