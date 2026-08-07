"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { bulkMoveVials } from "@/app/(portals)/admin/samples/actions";
import { Button, Input, Label } from "@/components/ui/primitives";

type Tank = { id: string; tankCode: string; name: string };
type Witness = { id: string; email: string };

export function BulkMovePanel({
  tanks,
  witnesses,
}: {
  tanks: Tank[];
  witnesses: Witness[];
}) {
  const router = useRouter();
  const [vialIds, setVialIds] = useState("");
  const [tankId, setTankId] = useState(tanks[0]?.id ?? "");
  const [canister, setCanister] = useState("C1");
  const [rack, setRack] = useState("R1");
  const [position, setPosition] = useState("");
  const [witnessUserId, setWitnessUserId] = useState(witnesses[0]?.id ?? "");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const ids = vialIds
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const result = await bulkMoveVials({
        vialIds: ids,
        tankId,
        canisterCode: canister,
        rackCode: rack,
        positionCode: position || undefined,
        witnessUserId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Vials relocated (2-witness attested)");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Move failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-xl border border-stone-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-stone-900">
        Bulk relocate (2-witness required)
      </h2>
      <div className="space-y-1.5">
        <Label>Vial IDs (comma or space separated)</Label>
        <Input value={vialIds} onChange={(e) => setVialIds(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Tank</Label>
          <select
            className="flex h-10 w-full rounded-md border border-stone-300 px-2 text-sm"
            value={tankId}
            onChange={(e) => setTankId(e.target.value)}
          >
            {tanks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.tankCode} — {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Canister</Label>
          <Input value={canister} onChange={(e) => setCanister(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Rack</Label>
          <Input value={rack} onChange={(e) => setRack(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Position</Label>
          <Input value={position} onChange={(e) => setPosition(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Witness</Label>
        <select
          className="flex h-10 w-full rounded-md border border-stone-300 px-2 text-sm"
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
      <Button type="submit" disabled={loading || !witnessUserId}>
        {loading ? "Moving…" : "Move vials"}
      </Button>
    </form>
  );
}
