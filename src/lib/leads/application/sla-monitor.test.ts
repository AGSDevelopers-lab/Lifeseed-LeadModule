import { describe, expect, it } from "vitest";

import { bucketSlaBreachRateByWeek } from "./sla-buckets";

describe("B17-B SLA week buckets", () => {
  it("computes % BREACHED per week", () => {
    const now = new Date("2026-09-14T00:00:00.000Z");
    const rows = [
      {
        createdAt: new Date("2026-09-08T00:00:00.000Z"),
        responseDueAt: new Date("2026-09-10T00:00:00.000Z"),
        status: "BREACHED",
      },
      {
        createdAt: new Date("2026-09-08T00:00:00.000Z"),
        responseDueAt: new Date("2026-09-11T00:00:00.000Z"),
        status: "ACTIVE",
      },
    ];
    const buckets = bucketSlaBreachRateByWeek(rows, 2, now);
    const withData = buckets.filter((b) => b.total > 0);
    expect(withData.length).toBeGreaterThan(0);
    expect(withData[0].breached).toBe(1);
    expect(withData[0].ratePct).toBe(50);
  });
});
