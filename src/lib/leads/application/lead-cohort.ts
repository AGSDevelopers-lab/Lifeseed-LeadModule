import { LeadStatus } from "@prisma/client";

export type CohortWindowCell =
  | { status: "in_progress" }
  | { status: "complete"; ratePct: number; converted: number; cohortSize: number };

export type MonthlyCohortRow = {
  month: string;
  cohortSize: number;
  d30: CohortWindowCell;
  d60: CohortWindowCell;
  d90: CohortWindowCell;
};

const MS_DAY = 24 * 60 * 60 * 1000;

function endOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isConverted(row: { status: string; outcome: string | null }): boolean {
  return row.status === LeadStatus.CONVERTED || row.outcome === "WON";
}

function windowCell(
  members: Array<{ createdAt: Date; convertedAt: Date | null; status: string; outcome: string | null }>,
  days: number,
  now: Date,
): CohortWindowCell {
  const windowMs = days * MS_DAY;
  const newest = members.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)).createdAt;
  const monthEnd = endOfUtcMonth(newest);
  if (now.getTime() < monthEnd.getTime() + windowMs) {
    return { status: "in_progress" };
  }
  let converted = 0;
  for (const m of members) {
    if (!m.convertedAt || !isConverted(m)) continue;
    if (m.convertedAt.getTime() - m.createdAt.getTime() <= windowMs) converted += 1;
  }
  const cohortSize = members.length;
  return {
    status: "complete",
    ratePct: cohortSize === 0 ? 0 : Math.round((converted / cohortSize) * 1000) / 10,
    converted,
    cohortSize,
  };
}

/** Monthly entry cohort × 30/60/90-day conversion. Ineligible windows are in_progress, never 0%. */
export function computeMonthlyConversionCohorts(
  rows: Array<{ createdAt: Date; convertedAt: Date | null; status: string; outcome: string | null }>,
  now: Date,
): MonthlyCohortRow[] {
  const byMonth = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = monthKey(row.createdAt);
    const list = byMonth.get(key) ?? [];
    list.push(row);
    byMonth.set(key, list);
  }
  const months = [...byMonth.keys()].sort().reverse();
  return months.map((month) => {
    const members = byMonth.get(month) ?? [];
    return {
      month,
      cohortSize: members.length,
      d30: windowCell(members, 30, now),
      d60: windowCell(members, 60, now),
      d90: windowCell(members, 90, now),
    };
  });
}
