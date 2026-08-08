"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmbryoDisposition, OocyteMaturity, PgtResult } from "@prisma/client";
import { toast } from "sonner";

import { updateEmbryoDispositions } from "@/app/(portals)/clinic/cohorts/actions";
import { Button } from "@/components/ui/primitives";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type EmbryoRow = {
  id: string;
  oocyteId: string;
  oocyteMaturity: OocyteMaturity | null;
  day1_2pn: boolean | null;
  day3Grade: string | null;
  day5Gardner: string | null;
  pgtResult: PgtResult | null;
  disposition: EmbryoDisposition | null;
  storageRef: string | null;
};

const DISPOSITIONS = Object.values(EmbryoDisposition);

export function CohortTable({
  drfId,
  embryos,
  canEdit,
  witnesses,
}: {
  drfId: string;
  embryos: EmbryoRow[];
  canEdit: boolean;
  witnesses: Array<{ id: string; email: string }>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [witnessUserId, setWitnessUserId] = useState(witnesses[0]?.id ?? "");
  const [pending, setPending] = useState(false);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function bulk(disposition: EmbryoDisposition) {
    if (selected.length === 0) {
      toast.error("Select embryos first");
      return;
    }
    setPending(true);
    const result = await updateEmbryoDispositions({
      drfId,
      embryoIds: selected,
      disposition,
      witnessUserId:
        disposition === EmbryoDisposition.VITRIFIED ||
        disposition === EmbryoDisposition.DISCARDED_ABNORMAL ||
        disposition === EmbryoDisposition.DISCARDED_ARREST
          ? witnessUserId
          : undefined,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error ?? "Update failed");
      return;
    }
    toast.success("Dispositions updated");
    setSelected([]);
    router.refresh();
  }

  async function onRowDisposition(embryoId: string, disposition: EmbryoDisposition) {
    if (!canEdit) return;
    setPending(true);
    const result = await updateEmbryoDispositions({
      drfId,
      embryoIds: [embryoId],
      disposition,
      witnessUserId:
        disposition === EmbryoDisposition.VITRIFIED ||
        disposition === EmbryoDisposition.DISCARDED_ABNORMAL ||
        disposition === EmbryoDisposition.DISCARDED_ARREST
          ? witnessUserId
          : undefined,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error ?? "Update failed");
      return;
    }
    toast.success("Updated");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-600">Witness</label>
            <select
              className="flex h-10 rounded-md border border-stone-300 bg-white px-3 text-sm"
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
          <Button
            variant="outline"
            disabled={pending || selected.length === 0}
            onClick={() => bulk(EmbryoDisposition.VITRIFIED)}
          >
            Vitrify selected
          </Button>
          <Button
            variant="destructive"
            disabled={pending || selected.length === 0}
            onClick={() => bulk(EmbryoDisposition.DISCARDED_ARREST)}
          >
            Discard selected
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              {canEdit && <TableHead className="w-10" />}
              <TableHead>Embryo ref</TableHead>
              <TableHead>Maturity</TableHead>
              <TableHead>Day1 2PN</TableHead>
              <TableHead>Day3</TableHead>
              <TableHead>Day5 Gardner</TableHead>
              <TableHead>PGT</TableHead>
              <TableHead>Disposition</TableHead>
              <TableHead>Storage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {embryos.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 9 : 8}
                  className="text-center text-stone-500"
                >
                  No embryos recorded yet — log OOCYTES_RETRIEVED / grading events.
                </TableCell>
              </TableRow>
            )}
            {embryos.map((e) => (
              <TableRow key={e.id}>
                {canEdit && (
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.includes(e.id)}
                      onChange={() => toggle(e.id)}
                    />
                  </TableCell>
                )}
                <TableCell className="font-mono text-xs">{e.oocyteId}</TableCell>
                <TableCell className="text-xs">{e.oocyteMaturity ?? "—"}</TableCell>
                <TableCell className="text-xs">
                  {e.day1_2pn == null ? "—" : e.day1_2pn ? "Yes" : "No"}
                </TableCell>
                <TableCell className="text-xs">{e.day3Grade ?? "—"}</TableCell>
                <TableCell className="text-xs">{e.day5Gardner ?? "—"}</TableCell>
                <TableCell className="text-xs">{e.pgtResult ?? "—"}</TableCell>
                <TableCell>
                  {canEdit ? (
                    <select
                      className="h-8 rounded-md border border-stone-300 bg-white px-2 text-xs"
                      value={e.disposition ?? ""}
                      disabled={pending}
                      onChange={(ev) =>
                        onRowDisposition(
                          e.id,
                          ev.target.value as EmbryoDisposition,
                        )
                      }
                    >
                      <option value="">—</option>
                      {DISPOSITIONS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs">{e.disposition ?? "—"}</span>
                  )}
                </TableCell>
                <TableCell className="text-xs">{e.storageRef ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
