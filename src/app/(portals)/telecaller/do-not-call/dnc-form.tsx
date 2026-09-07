"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { addToDnc } from "@/app/(portals)/leads/actions";
import { Button, Input } from "@/components/ui/primitives";

type DncRow = {
  id: string;
  channel: string;
  value: string;
  phone: string;
  email: string | null;
  reason: string;
  source: string;
  effectiveFrom: string | Date;
  effectiveUntil: string | Date | null;
  removalAuthorityUserId: string | null;
  createdByUserId: string;
};

function parseCsv(text: string): Array<{ channel: "PHONE" | "EMAIL" | "SMS" | "WHATSAPP" | "ALL"; value: string; reason: string }> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: Array<{ channel: "PHONE" | "EMAIL" | "SMS" | "WHATSAPP" | "ALL"; value: string; reason: string }> = [];
  for (const line of lines) {
    if (/^channel,/i.test(line)) continue;
    const [channelRaw, value, ...rest] = line.split(",");
    const channel = (channelRaw ?? "PHONE").trim().toUpperCase();
    if (!value?.trim()) continue;
    const allowed = ["PHONE", "EMAIL", "SMS", "WHATSAPP", "ALL"] as const;
    const ch = allowed.includes(channel as (typeof allowed)[number])
      ? (channel as (typeof allowed)[number])
      : "PHONE";
    out.push({ channel: ch, value: value.trim(), reason: rest.join(",").trim() || "CSV import" });
  }
  return out;
}

export function DncForm({ canRemove = false }: { canRemove?: boolean }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const result = await addToDnc({ phone, email: email || undefined, reason });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Added to DNC");
    setPhone("");
    setEmail("");
    setReason("");
    router.refresh();
  }

  async function onCsv(file: File) {
    const text = await file.text();
    const entries = parseCsv(text);
    if (entries.length === 0) {
      toast.error("No CSV rows found (channel,value,reason)");
      return;
    }
    const res = await fetch("/api/leads/v2/dnc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: entries[0].channel,
        value: entries[0].value,
        reason: entries[0].reason,
        entries,
      }),
    });
    if (!res.ok) {
      toast.error("CSV import failed");
      return;
    }
    toast.success(`Imported ${entries.length} DNC rows`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={onSubmit}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4"
      >
        <Input
          required
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="max-w-[160px]"
        />
        <Input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="max-w-[200px]"
        />
        <Input
          required
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="max-w-[240px]"
        />
        <Button type="submit" disabled={pending}>
          Add to DNC
        </Button>
        <label className="text-xs text-stone-600">
          CSV import
          <input
            type="file"
            accept=".csv,text/csv"
            className="ml-2 text-xs"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onCsv(f);
            }}
          />
        </label>
      </form>
      {canRemove ? (
        <p className="text-xs text-stone-500">
          Removing an entry requires an authority note (use Remove on a row).
        </p>
      ) : null}
    </div>
  );
}

export function DncRemoveButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onRemove() {
    const note = window.prompt("Authority note (required to remove)");
    if (!note?.trim()) {
      toast.error("Authority note is required");
      return;
    }
    setPending(true);
    const res = await fetch(`/api/leads/v2/dnc/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorityNote: note.trim() }),
    });
    setPending(false);
    if (!res.ok) {
      toast.error("Remove failed");
      return;
    }
    toast.success("DNC entry removed");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" disabled={pending} onClick={() => void onRemove()}>
      Remove
    </Button>
  );
}

export function formatWhen(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? value : value.toISOString();
  return d.slice(0, 10);
}

export type { DncRow };
