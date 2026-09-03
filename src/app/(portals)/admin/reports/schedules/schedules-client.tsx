"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button, Input, Label } from "@/components/ui/primitives";
import {
  COMPARE_LABELS,
  COMPARE_PRESETS,
  DATA_WINDOW_LABELS,
  DATA_WINDOW_PRESETS,
  defaultScheduleDetail,
  isValidCron,
  summarizeSchedule,
  type ComparePreset,
  type DataWindowPreset,
  type ScheduleDetail,
} from "@/lib/reports/schedule-presets";

type Schedule = {
  id: string;
  reportId: string;
  cadence: string;
  exportFormat: string;
  nextRunAt: string | null;
  isActive: boolean;
  scheduleDetail?: unknown;
  dataWindowPreset?: string | null;
  comparePreset?: string | null;
};

const CADENCES = [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "ANNUALLY",
  "CUSTOM",
] as const;

const WEEKDAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function timeValue(detail: ScheduleDetail): string {
  const h = String(detail.hour).padStart(2, "0");
  const m = String(detail.minute).padStart(2, "0");
  return `${h}:${m}`;
}

function parseTime(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(":").map(Number);
  return {
    hour: Number.isFinite(h) ? h : 8,
    minute: Number.isFinite(m) ? m : 0,
  };
}

export default function SchedulesClient() {
  const sp = useSearchParams();
  const prefillReport = sp.get("reportId") ?? "";
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [step, setStep] = useState(1);
  const [reportId, setReportId] = useState(prefillReport);
  const [cadence, setCadence] = useState<(typeof CADENCES)[number]>("WEEKLY");
  const [detail, setScheduleDetail] = useState<ScheduleDetail>(() =>
    defaultScheduleDetail("WEEKLY"),
  );
  const [dataWindowPreset, setDataWindowPreset] =
    useState<DataWindowPreset>("LAST_MONTH");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [comparePreset, setComparePreset] = useState<ComparePreset | "NONE">(
    "NONE",
  );
  const [compareFrom, setCompareFrom] = useState("");
  const [compareTo, setCompareTo] = useState("");
  const [format, setFormat] = useState("PDF");
  const [subscriberIds, setSubscriberIds] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/reports/schedules", { credentials: "include" });
    if (!res.ok) return;
    const j = (await res.json()) as { schedules: Schedule[] };
    setSchedules(j.schedules);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setScheduleDetail((prev) => ({
      ...defaultScheduleDetail(cadence),
      ...prev,
      hour: prev.hour,
      minute: prev.minute,
    }));
  }, [cadence]);

  const reviewSummary = useMemo(
    () =>
      summarizeSchedule({
        cadence,
        exportFormat: format,
        scheduleDetail: detail,
        dataWindowPreset,
        comparePreset: comparePreset === "NONE" ? null : comparePreset,
      }),
    [cadence, comparePreset, dataWindowPreset, detail, format],
  );

  function canAdvance(): boolean {
    if (step === 1) {
      if (!reportId.trim()) return false;
      if (cadence === "CUSTOM" && !isValidCron(detail.cron ?? "")) return false;
      return true;
    }
    if (step === 2) {
      if (dataWindowPreset === "CUSTOM") return Boolean(customFrom && customTo);
      return true;
    }
    if (step === 3) {
      if (comparePreset === "CUSTOM") return Boolean(compareFrom && compareTo);
      return true;
    }
    return true;
  }

  async function create() {
    setSaving(true);
    try {
      const ids = subscriberIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/reports/schedules", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: reportId.trim(),
          cadence,
          exportFormat: format,
          filterValues: {},
          subscriberUserIds: ids,
          deliveryChannel: "EMAIL",
          scheduleDetail: detail,
          dataWindowPreset,
          dataWindowCustomFrom: customFrom || undefined,
          dataWindowCustomTo: customTo || undefined,
          comparePreset: comparePreset === "NONE" ? null : comparePreset,
          compareCustomFrom: compareFrom || undefined,
          compareCustomTo: compareTo || undefined,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: unknown };
        console.error("[reports] schedule create failed", res.status, j);
        toast.error("Could not create schedule — please retry");
        return;
      }
      toast.success("Schedule created");
      setStep(1);
      await load();
    } catch (e) {
      console.error("[reports] schedule create failed", e);
      toast.error("Could not create schedule — please retry");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/reports/schedules/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      toast.error("Could not delete schedule");
      return;
    }
    toast.success("Schedule deleted");
    await load();
  }

  return (
    <div className="space-y-6 p-6">
      <Link href="/admin/reports" className="text-sm text-emerald-800 hover:underline">
        ← Reports home
      </Link>
      <h1 className="text-2xl font-semibold">Report schedules</h1>

      <section className="max-w-2xl space-y-4 rounded-lg border border-stone-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Create schedule</h2>
          <ol className="flex gap-2 text-xs text-stone-500">
            {[1, 2, 3, 4].map((n) => (
              <li
                key={n}
                className={
                  n === step
                    ? "rounded-full bg-emerald-800 px-2 py-0.5 font-medium text-white"
                    : "rounded-full bg-stone-100 px-2 py-0.5"
                }
              >
                {n}
              </li>
            ))}
          </ol>
        </div>

        {step === 1 ? (
          <div className="space-y-3">
            <p className="text-sm text-stone-600">Pick cadence and when it should run (IST).</p>
            <div className="space-y-1">
              <Label htmlFor="reportId">Report ID</Label>
              <Input
                id="reportId"
                value={reportId}
                onChange={(e) => setReportId(e.target.value)}
                placeholder="clinical.donor_acceptance"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cadence">Cadence</Label>
              <select
                id="cadence"
                className="h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
                value={cadence}
                onChange={(e) =>
                  setCadence(e.target.value as (typeof CADENCES)[number])
                }
              >
                {CADENCES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {cadence !== "CUSTOM" ? (
              <div className="space-y-1">
                <Label htmlFor="time">Time of day (IST)</Label>
                <Input
                  id="time"
                  type="time"
                  value={timeValue(detail)}
                  onChange={(e) =>
                    setScheduleDetail((d) => ({ ...d, ...parseTime(e.target.value) }))
                  }
                />
              </div>
            ) : null}

            {cadence === "WEEKLY" ? (
              <div className="space-y-1">
                <Label htmlFor="dow">Day of week</Label>
                <select
                  id="dow"
                  className="h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
                  value={detail.dayOfWeek ?? 1}
                  onChange={(e) =>
                    setScheduleDetail((d) => ({
                      ...d,
                      dayOfWeek: Number(e.target.value),
                    }))
                  }
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {cadence === "MONTHLY" ||
            cadence === "QUARTERLY" ||
            cadence === "ANNUALLY" ? (
              <div className="space-y-1">
                <Label htmlFor="dom">Day of month</Label>
                <select
                  id="dom"
                  className="h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
                  value={detail.dayOfMonth === "LAST" ? "LAST" : String(detail.dayOfMonth ?? 1)}
                  onChange={(e) =>
                    setScheduleDetail((d) => ({
                      ...d,
                      dayOfMonth:
                        e.target.value === "LAST" ? "LAST" : Number(e.target.value),
                    }))
                  }
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                  <option value="LAST">Last day of month</option>
                </select>
              </div>
            ) : null}

            {cadence === "QUARTERLY" ? (
              <div className="space-y-1">
                <Label htmlFor="qm">Month within quarter</Label>
                <select
                  id="qm"
                  className="h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
                  value={detail.quarterMonth ?? 1}
                  onChange={(e) =>
                    setScheduleDetail((d) => ({
                      ...d,
                      quarterMonth: Number(e.target.value) as 1 | 2 | 3,
                    }))
                  }
                >
                  <option value={1}>1st month (Jan / Apr / Jul / Oct)</option>
                  <option value={2}>2nd month (Feb / May / Aug / Nov)</option>
                  <option value={3}>3rd month (Mar / Jun / Sep / Dec)</option>
                </select>
              </div>
            ) : null}

            {cadence === "ANNUALLY" ? (
              <div className="space-y-1">
                <Label htmlFor="month">Month</Label>
                <select
                  id="month"
                  className="h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
                  value={detail.month ?? 1}
                  onChange={(e) =>
                    setScheduleDetail((d) => ({
                      ...d,
                      month: Number(e.target.value),
                    }))
                  }
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {cadence === "CUSTOM" ? (
              <div className="space-y-1">
                <Label htmlFor="cron">Cron (min hour day-of-month month day-of-week)</Label>
                <Input
                  id="cron"
                  value={detail.cron ?? ""}
                  onChange={(e) =>
                    setScheduleDetail((d) => ({ ...d, cron: e.target.value }))
                  }
                  placeholder="0 8 * * 1"
                />
                {detail.cron && !isValidCron(detail.cron) ? (
                  <p className="text-xs text-red-600">Invalid cron syntax</p>
                ) : (
                  <p className="text-xs text-stone-500">Example: 0 8 * * 1 = Mondays at 08:00 IST</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <p className="text-sm text-stone-600">
              Data window is computed at each run. Example: Monthly on the 3rd with Last month
              reports month N−1.
            </p>
            <div className="space-y-1">
              <Label htmlFor="window">Data window preset</Label>
              <select
                id="window"
                className="h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
                value={dataWindowPreset}
                onChange={(e) =>
                  setDataWindowPreset(e.target.value as DataWindowPreset)
                }
              >
                {DATA_WINDOW_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {DATA_WINDOW_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            {dataWindowPreset === "CUSTOM" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="from">From</Label>
                  <Input
                    id="from"
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="to">To</Label>
                  <Input
                    id="to"
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <p className="text-sm text-stone-600">
              Optional comparison window, stored on the run and passed as filters.
            </p>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-stone-800">Compare with</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="compare"
                  checked={comparePreset === "NONE"}
                  onChange={() => setComparePreset("NONE")}
                />
                None
              </label>
              {COMPARE_PRESETS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="compare"
                    checked={comparePreset === p}
                    onChange={() => setComparePreset(p)}
                  />
                  {COMPARE_LABELS[p]}
                </label>
              ))}
            </fieldset>
            {comparePreset === "CUSTOM" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="cfrom">Compare from</Label>
                  <Input
                    id="cfrom"
                    type="date"
                    value={compareFrom}
                    onChange={(e) => setCompareFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cto">Compare to</Label>
                  <Input
                    id="cto"
                    type="date"
                    value={compareTo}
                    onChange={(e) => setCompareTo(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="format">Format</Label>
              <select
                id="format"
                className="h-10 w-full rounded-md border border-stone-300 px-3 text-sm"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                {["CSV", "XLSX", "PDF"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="subs">Subscriber user IDs (comma-separated)</Label>
              <Input
                id="subs"
                value={subscriberIds}
                onChange={(e) => setSubscriberIds(e.target.value)}
                placeholder="Leave empty to email yourself"
              />
            </div>
            <div className="rounded-md bg-stone-50 px-3 py-3 text-sm text-stone-700">
              <div className="font-medium text-stone-900">{reportId || "—"}</div>
              <div className="mt-1">{reviewSummary}</div>
            </div>
          </div>
        ) : null}

        <div className="flex justify-between gap-2 pt-2">
          <Button
            variant="outline"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            Back
          </Button>
          {step < 4 ? (
            <Button disabled={!canAdvance()} onClick={() => setStep((s) => s + 1)}>
              Next
            </Button>
          ) : (
            <Button disabled={saving || !canAdvance()} onClick={() => void create()}>
              {saving ? "Saving…" : "Create schedule"}
            </Button>
          )}
        </div>
      </section>

      <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
        {schedules.length === 0 ? (
          <li className="px-4 py-8 text-sm text-stone-600">No schedules yet.</li>
        ) : (
          schedules.map((s) => (
            <li
              key={s.id}
              className="flex items-start justify-between gap-3 px-4 py-3 text-sm"
            >
              <div>
                <div className="font-medium">{s.reportId}</div>
                <div className="text-xs text-stone-500">
                  {summarizeSchedule({
                    cadence: s.cadence,
                    exportFormat: s.exportFormat,
                    scheduleDetail: s.scheduleDetail,
                    dataWindowPreset: s.dataWindowPreset,
                    comparePreset: s.comparePreset,
                  })}
                </div>
                <div className="text-xs text-stone-400">
                  next{" "}
                  {s.nextRunAt
                    ? new Date(s.nextRunAt).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })
                    : "—"}{" "}
                  IST
                </div>
              </div>
              <Button variant="ghost" onClick={() => void remove(s.id)}>
                Delete
              </Button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
