"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CounsellingMode } from "@prisma/client";
import { toast } from "sonner";

import { bookCounselling } from "@/app/(portals)/leads/actions";
import { Button, Input, Label } from "@/components/ui/primitives";

function next14Days(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

const SLOTS = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"];

export function BookCounsellingForm({
  leadId,
  counsellors,
}: {
  leadId: string;
  counsellors: Array<{ id: string; email: string }>;
}) {
  const router = useRouter();
  const days = useMemo(() => next14Days(), []);
  const [day, setDay] = useState(days[0] ?? "");
  const [slot, setSlot] = useState(SLOTS[0]);
  const [counsellorUserId, setCounsellorUserId] = useState(
    counsellors[0]?.id ?? "",
  );
  const [mode, setMode] = useState<CounsellingMode>(CounsellingMode.VIDEO_CALL);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!counsellorUserId) {
      toast.error("No counsellor available");
      return;
    }
    setPending(true);
    const scheduledAt = new Date(`${day}T${slot}:00.000Z`).toISOString();
    const result = await bookCounselling({
      leadId,
      counsellorUserId,
      scheduledAt,
      mode,
      meetingUrl: meetingUrl || undefined,
      meetingLocation: meetingLocation || undefined,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Counselling booked");
    router.push(`/telecaller/leads/${leadId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-4 rounded-xl border border-stone-200 bg-white p-6">
      <div className="space-y-2">
        <Label>Counsellor</Label>
        <select
          className="flex h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
          value={counsellorUserId}
          onChange={(e) => setCounsellorUserId(e.target.value)}
        >
          {counsellors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.email}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Day (next 14)</Label>
        <select
          className="flex h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        >
          {days.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Slot (UTC)</Label>
        <div className="flex flex-wrap gap-2">
          {SLOTS.map((s) => (
            <button
              key={s}
              type="button"
              className={`rounded-md px-2 py-1 text-xs ring-1 ${
                slot === s
                  ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                  : "bg-white ring-stone-200"
              }`}
              onClick={() => setSlot(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Mode</Label>
        <select
          className="flex h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
          value={mode}
          onChange={(e) => setMode(e.target.value as CounsellingMode)}
        >
          {Object.values(CounsellingMode).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      {mode === CounsellingMode.VIDEO_CALL && (
        <Input
          placeholder="Meeting URL"
          value={meetingUrl}
          onChange={(e) => setMeetingUrl(e.target.value)}
        />
      )}
      {mode === CounsellingMode.IN_PERSON && (
        <Input
          placeholder="Location"
          value={meetingLocation}
          onChange={(e) => setMeetingLocation(e.target.value)}
        />
      )}
      <Button type="submit" disabled={pending}>
        Book session
      </Button>
    </form>
  );
}
