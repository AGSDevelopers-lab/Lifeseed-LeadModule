"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/primitives";

export function TriggerNudgesButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/embryology/nudges/run", { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        nudges?: { sent: number; skipped: number };
        autoClose?: { closed: number };
      };
      if (!res.ok) {
        toast.error(data.error ?? "Failed");
        return;
      }
      toast.success(
        `Nudges sent ${data.nudges?.sent ?? 0}, skipped ${data.nudges?.skipped ?? 0}; auto-closed ${data.autoClose?.closed ?? 0}`,
      );
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={onClick} disabled={loading}>
      {loading ? "Running…" : "Trigger nudges now"}
    </Button>
  );
}
