import type { ReportCadence } from "@prisma/client";

export const IST_TZ = "Asia/Kolkata";

export type ScheduleDetail = {
  hour: number;
  minute: number;
  dayOfWeek?: number;
  dayOfMonth?: number | "LAST";
  quarterMonth?: 1 | 2 | 3;
  month?: number;
  cron?: string;
};

export const DATA_WINDOW_PRESETS = [
  "THIS_WEEK",
  "LAST_WEEK",
  "THIS_MONTH",
  "LAST_MONTH",
  "THIS_QUARTER",
  "LAST_QUARTER",
  "THIS_YEAR",
  "LAST_YEAR",
  "TRAILING_7D",
  "TRAILING_30D",
  "TRAILING_90D",
  "CUSTOM",
] as const;

export type DataWindowPreset = (typeof DATA_WINDOW_PRESETS)[number];

export const COMPARE_PRESETS = [
  "PREVIOUS_PERIOD",
  "SAME_PERIOD_LAST_YEAR",
  "SAME_PERIOD_2Y_AGO",
  "CUSTOM",
] as const;

export type ComparePreset = (typeof COMPARE_PRESETS)[number];

export const DATA_WINDOW_LABELS: Record<DataWindowPreset, string> = {
  THIS_WEEK: "This week (Mon–today)",
  LAST_WEEK: "Last week (Mon–Sun)",
  THIS_MONTH: "This month (1st–today)",
  LAST_MONTH: "Last month",
  THIS_QUARTER: "This quarter",
  LAST_QUARTER: "Last quarter",
  THIS_YEAR: "This year (Jan 1–today)",
  LAST_YEAR: "Last year",
  TRAILING_7D: "Trailing 7 days",
  TRAILING_30D: "Trailing 30 days",
  TRAILING_90D: "Trailing 90 days",
  CUSTOM: "Custom range",
};

export const COMPARE_LABELS: Record<ComparePreset, string> = {
  PREVIOUS_PERIOD: "Previous period",
  SAME_PERIOD_LAST_YEAR: "Same period last year",
  SAME_PERIOD_2Y_AGO: "Same period 2 years ago",
  CUSTOM: "Custom comparison window",
};

export type IstParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  isoWeekday: number;
};

const WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function istWallToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  return new Date(
    `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+05:30`,
  );
}

export function getIstParts(d: Date): IstParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const map = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    isoWeekday: WEEKDAY_TO_ISO[map.weekday ?? "Mon"] ?? 1,
  };
}

export function isoDateIst(d: Date): string {
  const p = getIstParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function resolveDayOfMonth(
  year: number,
  month: number,
  dayOfMonth: number | "LAST" | undefined,
): number {
  const last = daysInMonth(year, month);
  if (dayOfMonth === "LAST") return last;
  const day = dayOfMonth ?? 1;
  return Math.min(Math.max(1, day), last);
}

export function defaultScheduleDetail(cadence: ReportCadence): ScheduleDetail {
  return {
    hour: 8,
    minute: 0,
    dayOfWeek: 1,
    dayOfMonth: 1,
    quarterMonth: 1,
    month: 1,
    cron: cadence === "CUSTOM" ? "0 8 * * *" : undefined,
  };
}

export function parseScheduleDetail(raw: unknown): ScheduleDetail | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const hour = typeof o.hour === "number" ? o.hour : 8;
  const minute = typeof o.minute === "number" ? o.minute : 0;
  const detail: ScheduleDetail = {
    hour: Math.min(23, Math.max(0, Math.trunc(hour))),
    minute: Math.min(59, Math.max(0, Math.trunc(minute))),
  };
  if (typeof o.dayOfWeek === "number") detail.dayOfWeek = o.dayOfWeek;
  if (o.dayOfMonth === "LAST" || typeof o.dayOfMonth === "number") {
    detail.dayOfMonth = o.dayOfMonth;
  }
  if (o.quarterMonth === 1 || o.quarterMonth === 2 || o.quarterMonth === 3) {
    detail.quarterMonth = o.quarterMonth;
  }
  if (typeof o.month === "number") detail.month = o.month;
  if (typeof o.cron === "string") detail.cron = o.cron;
  return detail;
}

function cronFieldValid(field: string, min: number, max: number): boolean {
  if (field === "*") return true;
  return field.split(",").every((part) => {
    const [range, stepRaw] = part.split("/");
    if (stepRaw !== undefined) {
      const step = Number(stepRaw);
      if (!Number.isInteger(step) || step < 1) return false;
    }
    if (range === "*") return true;
    if (range.includes("-")) {
      const [a, b] = range.split("-").map(Number);
      return (
        Number.isInteger(a) &&
        Number.isInteger(b) &&
        a >= min &&
        b <= max &&
        a <= b
      );
    }
    const n = Number(range);
    return Number.isInteger(n) && n >= min && n <= max;
  });
}

export function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour, dom, month, dow] = parts;
  return (
    cronFieldValid(minute, 0, 59) &&
    cronFieldValid(hour, 0, 23) &&
    cronFieldValid(dom, 1, 31) &&
    cronFieldValid(month, 1, 12) &&
    cronFieldValid(dow, 0, 7)
  );
}

function cronTokenMatches(field: string, value: number, min: number, max: number): boolean {
  if (field === "*") return true;
  return field.split(",").some((part) => {
    const [range, stepRaw] = part.split("/");
    const step = stepRaw ? Number(stepRaw) : 1;
    let start = min;
    let end = max;
    if (range === "*") {
      start = min;
      end = max;
    } else if (range.includes("-")) {
      const [a, b] = range.split("-").map(Number);
      start = a;
      end = b;
    } else {
      const n = Number(range);
      if (stepRaw) {
        start = n;
        end = max;
      } else {
        return n === value;
      }
    }
    if (value < start || value > end) return false;
    return (value - start) % step === 0;
  });
}

function cronMatchesIst(expr: string, p: IstParts): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour, dom, month, dow] = parts;
  const cronDow = p.isoWeekday === 7 ? 0 : p.isoWeekday;
  return (
    cronTokenMatches(minute, p.minute, 0, 59) &&
    cronTokenMatches(hour, p.hour, 0, 23) &&
    cronTokenMatches(dom, p.day, 1, 31) &&
    cronTokenMatches(month, p.month, 1, 12) &&
    (cronTokenMatches(dow, cronDow, 0, 7) ||
      cronTokenMatches(dow, p.isoWeekday === 7 ? 7 : p.isoWeekday, 0, 7))
  );
}

function nextMinute(from: Date): Date {
  const d = new Date(from.getTime());
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(d.getUTCMinutes() + 1);
  return d;
}

export function nextCronRunAt(cron: string, from: Date = new Date()): Date {
  if (!isValidCron(cron)) {
    throw new Error("Invalid cron expression");
  }
  let cursor = nextMinute(from);
  for (let i = 0; i < 366 * 24 * 60; i += 1) {
    if (cronMatchesIst(cron, getIstParts(cursor))) return cursor;
    cursor = new Date(cursor.getTime() + 60_000);
  }
  throw new Error("Could not resolve next cron run");
}

function addCalendarMonths(year: number, month: number, delta: number): {
  year: number;
  month: number;
} {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

function candidateMonthly(
  year: number,
  month: number,
  detail: ScheduleDetail,
): Date {
  const day = resolveDayOfMonth(year, month, detail.dayOfMonth);
  return istWallToUtc(year, month, day, detail.hour, detail.minute);
}

export function computeNextRunAt(
  cadence: ReportCadence,
  from: Date = new Date(),
  detailInput?: ScheduleDetail | null,
): Date {
  const detail = {
    ...defaultScheduleDetail(cadence),
    ...detailInput,
  };

  if (cadence === "CUSTOM" && detail.cron) {
    return nextCronRunAt(detail.cron, from);
  }

  const p = getIstParts(from);

  if (cadence === "DAILY" || cadence === "ON_DEMAND") {
    let next = istWallToUtc(p.year, p.month, p.day, detail.hour, detail.minute);
    if (next.getTime() <= from.getTime()) {
      const tp = addDaysIst(p.year, p.month, p.day, 1);
      next = istWallToUtc(tp.year, tp.month, tp.day, detail.hour, detail.minute);
    }
    return next;
  }

  if (cadence === "WEEKLY") {
    const targetDow = detail.dayOfWeek ?? 1;
    for (let i = 0; i < 8; i += 1) {
      const probe = new Date(from.getTime() + i * 24 * 3600_000);
      const pp = getIstParts(i === 0 ? from : probe);
      if (pp.isoWeekday !== targetDow) continue;
      const next = istWallToUtc(
        pp.year,
        pp.month,
        pp.day,
        detail.hour,
        detail.minute,
      );
      if (next.getTime() > from.getTime()) return next;
    }
    const fallback = new Date(from.getTime() + 7 * 24 * 3600_000);
    const fp = getIstParts(fallback);
    return istWallToUtc(fp.year, fp.month, fp.day, detail.hour, detail.minute);
  }

  if (cadence === "MONTHLY") {
    let next = candidateMonthly(p.year, p.month, detail);
    if (next.getTime() > from.getTime()) return next;
    const n = addCalendarMonths(p.year, p.month, 1);
    return candidateMonthly(n.year, n.month, detail);
  }

  if (cadence === "QUARTERLY") {
    const qm = detail.quarterMonth ?? 1;
    const months = [qm, qm + 3, qm + 6, qm + 9];
    for (let add = 0; add < 24; add += 1) {
      const { year, month } = addCalendarMonths(p.year, p.month, add);
      if (!months.includes(month)) continue;
      const next = candidateMonthly(year, month, detail);
      if (next.getTime() > from.getTime()) return next;
    }
  }

  if (cadence === "ANNUALLY") {
    const month = detail.month ?? 1;
    let next = candidateMonthly(p.year, month, detail);
    if (next.getTime() > from.getTime()) return next;
    return candidateMonthly(p.year + 1, month, detail);
  }

  const fallback = new Date(from);
  fallback.setUTCDate(fallback.getUTCDate() + 1);
  return fallback;
}

export type DateWindow = { from: Date; to: Date };

function startOfIstDay(year: number, month: number, day: number): Date {
  return istWallToUtc(year, month, day, 0, 0);
}

function endOfIstDay(year: number, month: number, day: number): Date {
  return istWallToUtc(year, month, day, 23, 59);
}

function mondayOfWeek(p: IstParts): { year: number; month: number; day: number } {
  const offset = p.isoWeekday - 1;
  const utc = startOfIstDay(p.year, p.month, p.day).getTime() - offset * 24 * 3600_000;
  const mp = getIstParts(new Date(utc + 6 * 3600_000));
  return { year: mp.year, month: mp.month, day: mp.day };
}

function addDaysIst(
  year: number,
  month: number,
  day: number,
  delta: number,
): IstParts {
  const d = new Date(startOfIstDay(year, month, day).getTime() + delta * 24 * 3600_000 + 6 * 3600_000);
  return getIstParts(d);
}

function quarterStartMonth(month: number): number {
  return Math.floor((month - 1) / 3) * 3 + 1;
}

export function resolveDataWindow(
  preset: DataWindowPreset | string | null | undefined,
  now: Date = new Date(),
  customFrom?: Date | null,
  customTo?: Date | null,
): DateWindow {
  const p = getIstParts(now);

  if (preset === "CUSTOM" && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }

  if (preset === "THIS_WEEK") {
    const mon = mondayOfWeek(p);
    return {
      from: startOfIstDay(mon.year, mon.month, mon.day),
      to: endOfIstDay(p.year, p.month, p.day),
    };
  }

  if (preset === "LAST_WEEK") {
    const mon = mondayOfWeek(p);
    const lastMon = addDaysIst(mon.year, mon.month, mon.day, -7);
    const lastSun = addDaysIst(mon.year, mon.month, mon.day, -1);
    return {
      from: startOfIstDay(lastMon.year, lastMon.month, lastMon.day),
      to: endOfIstDay(lastSun.year, lastSun.month, lastSun.day),
    };
  }

  if (preset === "THIS_MONTH") {
    return {
      from: startOfIstDay(p.year, p.month, 1),
      to: endOfIstDay(p.year, p.month, p.day),
    };
  }

  if (preset === "LAST_MONTH") {
    const prev = addCalendarMonths(p.year, p.month, -1);
    const last = daysInMonth(prev.year, prev.month);
    return {
      from: startOfIstDay(prev.year, prev.month, 1),
      to: endOfIstDay(prev.year, prev.month, last),
    };
  }

  if (preset === "THIS_QUARTER") {
    const qs = quarterStartMonth(p.month);
    return {
      from: startOfIstDay(p.year, qs, 1),
      to: endOfIstDay(p.year, p.month, p.day),
    };
  }

  if (preset === "LAST_QUARTER") {
    const qs = quarterStartMonth(p.month);
    const prevQ = addCalendarMonths(p.year, qs, -3);
    const endM = addCalendarMonths(prevQ.year, prevQ.month, 2);
    const last = daysInMonth(endM.year, endM.month);
    return {
      from: startOfIstDay(prevQ.year, prevQ.month, 1),
      to: endOfIstDay(endM.year, endM.month, last),
    };
  }

  if (preset === "THIS_YEAR") {
    return {
      from: startOfIstDay(p.year, 1, 1),
      to: endOfIstDay(p.year, p.month, p.day),
    };
  }

  if (preset === "LAST_YEAR") {
    return {
      from: startOfIstDay(p.year - 1, 1, 1),
      to: endOfIstDay(p.year - 1, 12, 31),
    };
  }

  if (preset === "TRAILING_7D" || preset === "TRAILING_30D" || preset === "TRAILING_90D") {
    const days = preset === "TRAILING_7D" ? 7 : preset === "TRAILING_30D" ? 30 : 90;
    const fromP = addDaysIst(p.year, p.month, p.day, -(days - 1));
    return {
      from: startOfIstDay(fromP.year, fromP.month, fromP.day),
      to: endOfIstDay(p.year, p.month, p.day),
    };
  }

  const fromP = addDaysIst(p.year, p.month, p.day, -29);
  return {
    from: startOfIstDay(fromP.year, fromP.month, fromP.day),
    to: endOfIstDay(p.year, p.month, p.day),
  };
}

function shiftYears(d: Date, years: number): Date {
  const p = getIstParts(d);
  const month = p.month;
  const day = Math.min(p.day, daysInMonth(p.year + years, month));
  return istWallToUtc(p.year + years, month, day, p.hour, p.minute);
}

export function resolveCompareWindow(
  preset: ComparePreset | string | null | undefined,
  dataWindow: DateWindow,
  customFrom?: Date | null,
  customTo?: Date | null,
): DateWindow | null {
  if (!preset) return null;
  if (preset === "CUSTOM" && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }
  if (preset === "PREVIOUS_PERIOD") {
    const span = dataWindow.to.getTime() - dataWindow.from.getTime();
    const to = new Date(dataWindow.from.getTime() - 60_000);
    const from = new Date(to.getTime() - span);
    return { from, to };
  }
  if (preset === "SAME_PERIOD_LAST_YEAR") {
    return {
      from: shiftYears(dataWindow.from, -1),
      to: shiftYears(dataWindow.to, -1),
    };
  }
  if (preset === "SAME_PERIOD_2Y_AGO") {
    return {
      from: shiftYears(dataWindow.from, -2),
      to: shiftYears(dataWindow.to, -2),
    };
  }
  return null;
}

const WEEKDAY_NAMES = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

function timeLabel(detail: ScheduleDetail): string {
  return `${pad(detail.hour)}:${pad(detail.minute)}`;
}

export function summarizeCadence(
  cadence: string,
  detailInput?: ScheduleDetail | null,
): string {
  const detail = {
    ...defaultScheduleDetail(cadence as ReportCadence),
    ...detailInput,
  };
  const t = timeLabel(detail);
  switch (cadence) {
    case "DAILY":
      return `Daily at ${t}`;
    case "WEEKLY":
      return `Weekly on ${WEEKDAY_NAMES[detail.dayOfWeek ?? 1]} at ${t}`;
    case "MONTHLY": {
      const day =
        detail.dayOfMonth === "LAST" ? "last day" : ordinal(detail.dayOfMonth ?? 1);
      return `Monthly on ${day} at ${t}`;
    }
    case "QUARTERLY": {
      const qm = detail.quarterMonth ?? 1;
      const qLabel = qm === 1 ? "1st" : qm === 2 ? "2nd" : "3rd";
      const day =
        detail.dayOfMonth === "LAST" ? "last day" : ordinal(detail.dayOfMonth ?? 1);
      return `Quarterly on ${qLabel} month, ${day} at ${t}`;
    }
    case "ANNUALLY": {
      const month = MONTH_NAMES[detail.month ?? 1];
      const day =
        detail.dayOfMonth === "LAST" ? "last day" : ordinal(detail.dayOfMonth ?? 1);
      return `Annually on ${month} ${day} at ${t}`;
    }
    case "CUSTOM":
      return `Custom cron (${detail.cron ?? "—"})`;
    default:
      return cadence;
  }
}

export function summarizeSchedule(input: {
  cadence: string;
  exportFormat: string;
  scheduleDetail?: unknown;
  dataWindowPreset?: string | null;
  comparePreset?: string | null;
}): string {
  const detail = parseScheduleDetail(input.scheduleDetail);
  const when = summarizeCadence(input.cadence, detail);
  const data =
    input.dataWindowPreset &&
    DATA_WINDOW_LABELS[input.dataWindowPreset as DataWindowPreset]
      ? DATA_WINDOW_LABELS[input.dataWindowPreset as DataWindowPreset]
      : "Saved filters";
  const compare = input.comparePreset
    ? COMPARE_LABELS[input.comparePreset as ComparePreset] ?? input.comparePreset
    : "None";
  return `${when} · Data: ${data} · Compare: ${compare} · ${input.exportFormat}`;
}
