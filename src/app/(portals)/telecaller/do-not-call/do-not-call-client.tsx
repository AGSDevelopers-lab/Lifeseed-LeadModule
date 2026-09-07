"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  addDncEntry,
  removeDncEntry,
} from "@/app/(portals)/telecaller/do-not-call/actions";
import { formatWhen } from "@/app/(portals)/telecaller/do-not-call/dnc-form";
import { Button, Input } from "@/components/ui/primitives";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CHANNELS = ["PHONE", "EMAIL", "WHATSAPP", "SMS", "ALL"] as const;
const SOURCES = [
  "MANUAL",
  "SELF_REQUEST",
  "OPS_ADD",
  "COMPLIANCE_ADD",
  "LEAD_REQUEST",
  "REGULATOR",
  "SYSTEM",
  "UNSUBSCRIBE_LINK",
] as const;

export type DncListRow = {
  id: string;
  channel: string;
  normalisedValue: string;
  email: string | null;
  reason: string;
  source: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  removalAuthorityUserId: string | null;
  createdByUserId: string;
};

export function DoNotCallClient({
  rows,
  canAdd,
  canRemove,
  variant = "telecaller",
}: {
  rows: DncListRow[];
  canAdd: boolean;
  canRemove: boolean;
  variant?: "telecaller" | "admin";
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("PHONE");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [source, setSource] = useState<(typeof SOURCES)[number]>("MANUAL");
  const [pending, setPending] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await addDncEntry({ channel, value, reason, source });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Added to DNC");
    setValue("");
    setReason("");
    setSource("MANUAL");
    setChannel("PHONE");
    setFormOpen(false);
    router.refresh();
  }

  async function onRemove(id: string) {
    const note = window.prompt("Authority note (required to remove)");
    if (!note?.trim()) {
      toast.error("Authority note is required");
      return;
    }
    setRemovingId(id);
    const result = await removeDncEntry({ id, authorityNote: note.trim() });
    setRemovingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("DNC entry removed");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Do Not Call</h1>
        {canAdd ? (
          <Button type="button" onClick={() => setFormOpen((open) => !open)}>
            Add
          </Button>
        ) : null}
      </div>

      {canAdd && formOpen ? (
        <form
          onSubmit={onSubmit}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4"
        >
          <label className="text-xs text-stone-600">
            Channel
            <select
              className="mt-1 flex h-10 w-full min-w-[140px] rounded-md border border-stone-300 bg-white px-3 text-sm"
              value={channel}
              onChange={(e) =>
                setChannel(e.target.value as (typeof CHANNELS)[number])
              }
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <Input
            required
            placeholder="Value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="max-w-[200px]"
          />
          <Input
            required
            placeholder="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="max-w-[240px]"
          />
          <label className="text-xs text-stone-600">
            Source
            <select
              className="mt-1 flex h-10 w-full min-w-[160px] rounded-md border border-stone-300 bg-white px-3 text-sm"
              value={source}
              onChange={(e) =>
                setSource(e.target.value as (typeof SOURCES)[number])
              }
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={pending}>
            Save
          </Button>
        </form>
      ) : null}

      {canRemove ? (
        <p className="text-xs text-stone-500">
          Removing an entry requires an authority note (use Remove on a row).
        </p>
      ) : null}

      <div className="rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead>Value</TableHead>
              {variant === "telecaller" ? <TableHead>Email</TableHead> : null}
              <TableHead>Reason</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>{variant === "admin" ? "Effective from" : "From"}</TableHead>
              <TableHead>Until</TableHead>
              {variant === "admin" ? <TableHead>Created by</TableHead> : null}
              <TableHead>Removal authority</TableHead>
              {canRemove ? <TableHead /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{r.channel}</TableCell>
                <TableCell>{r.normalisedValue}</TableCell>
                {variant === "telecaller" ? (
                  <TableCell className="text-xs">{r.email ?? "—"}</TableCell>
                ) : null}
                <TableCell className="text-xs">{r.reason}</TableCell>
                <TableCell className="text-xs">{r.source}</TableCell>
                <TableCell className="text-xs">{formatWhen(r.effectiveFrom)}</TableCell>
                <TableCell className="text-xs">{formatWhen(r.effectiveUntil)}</TableCell>
                {variant === "admin" ? (
                  <TableCell className="text-xs">{r.createdByUserId}</TableCell>
                ) : null}
                <TableCell className="text-xs">
                  {r.removalAuthorityUserId ?? "—"}
                </TableCell>
                {canRemove ? (
                  <TableCell>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={removingId === r.id}
                      onClick={() => void onRemove(r.id)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
