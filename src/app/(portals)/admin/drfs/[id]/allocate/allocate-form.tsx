"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { allocateVials } from "@/app/(portals)/admin/drfs/actions";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from "@/components/ui/primitives";

type VialRow = {
  id: string;
  vialCode: string;
  category: string | null;
  grade: string | null;
  tankCode: string;
  donorCode: string;
  samplePriority: string;
};

export function AllocateForm({
  drfId,
  requestedQuantity,
  priority,
  vials,
  witnesses,
}: {
  drfId: string;
  requestedQuantity: number;
  priority: string;
  vials: VialRow[];
  witnesses: Array<{ id: string; email: string }>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [witnessUserId, setWitnessUserId] = useState(witnesses[0]?.id ?? "");
  const [loading, setLoading] = useState(false);

  const sorted = useMemo(() => {
    // URGENT DRFs: show all, but surface URGENT-sample vials first
    const copy = [...vials];
    if (priority === "URGENT") {
      copy.sort((a, b) =>
        a.samplePriority === "URGENT" && b.samplePriority !== "URGENT"
          ? -1
          : b.samplePriority === "URGENT" && a.samplePriority !== "URGENT"
            ? 1
            : 0,
      );
    }
    return copy;
  }, [vials, priority]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.length === 0) {
      toast.error("Select at least one vial");
      return;
    }
    setLoading(true);
    try {
      const result = await allocateVials({
        drfId,
        vialIds: selected,
        witnessUserId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Vials allocated (2-witness)");
      router.push(`/admin/drfs/${drfId}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Allocate failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allocate vials</CardTitle>
        <CardDescription>
          Requested qty {requestedQuantity}. Matching released inventory
          {priority === "URGENT" ? " — URGENT queue first." : "."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border border-stone-200 p-2">
            {sorted.length === 0 && (
              <p className="p-2 text-sm text-stone-500">
                No matching available vials.
              </p>
            )}
            {sorted.map((v) => (
              <label
                key={v.id}
                className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-50"
              >
                <input
                  type="checkbox"
                  className="mt-1 accent-emerald-800"
                  checked={selected.includes(v.id)}
                  onChange={() => toggle(v.id)}
                />
                <span>
                  <span className="font-medium">{v.vialCode}</span>
                  <span className="text-stone-500">
                    {" "}
                    · {v.donorCode} · {v.category ?? "—"}/{v.grade ?? "—"} ·{" "}
                    {v.tankCode}
                    {v.samplePriority === "URGENT" ? " · URGENT sample" : ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Witness</Label>
            <select
              className="flex h-10 w-full max-w-md rounded-md border border-stone-300 px-2 text-sm"
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
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/admin/drfs/${drfId}`)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !witnessUserId}>
              {loading
                ? "Assigning…"
                : `Assign ${selected.length || ""} vial(s)`}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
