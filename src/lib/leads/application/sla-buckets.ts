export type SlaWeekBucket = {
  weekStart: string;
  total: number;
  breached: number;
  ratePct: number | null;
};

export function bucketSlaBreachRateByWeek(
  rows: Array<{ createdAt: Date; responseDueAt: Date; status: string }>,
  lookbackWeeks: number,
  now: Date,
): SlaWeekBucket[] {
  const buckets: SlaWeekBucket[] = [];
  const seen = new Set<string>();
  for (let i = lookbackWeeks - 1; i >= 0; i--) {
    const start = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    start.setUTCHours(0, 0, 0, 0);
    const day = start.getUTCDay();
    const mondayOffset = (day + 6) % 7;
    start.setUTCDate(start.getUTCDate() - mondayOffset);
    const key = start.toISOString().slice(0, 10);
    if (seen.has(key)) continue;
    seen.add(key);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const inBucket = rows.filter((r) => r.responseDueAt >= start && r.responseDueAt < end);
    const breached = inBucket.filter((r) => r.status === "BREACHED").length;
    buckets.push({
      weekStart: key,
      total: inBucket.length,
      breached,
      ratePct: inBucket.length === 0 ? null : Math.round((breached / inBucket.length) * 100),
    });
  }
  return buckets;
}
