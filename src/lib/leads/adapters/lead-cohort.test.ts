import { describe, expect, it } from "vitest";
import { LeadStatus } from "@prisma/client";

import { computeMonthlyConversionCohorts } from "../application/lead-cohort";

describe("B17-B G3 monthly conversion cohorts", () => {
  const now = new Date("2026-09-14T12:00:00.000Z");

  it("computes 30/60/90 rates for a fully aged cohort (not 0% for conversions in window)", () => {
    const rows = [
      {
        createdAt: new Date("2026-04-10T00:00:00.000Z"),
        convertedAt: new Date("2026-04-25T00:00:00.000Z"),
        status: LeadStatus.CONVERTED,
        outcome: "WON",
      },
      {
        createdAt: new Date("2026-04-12T00:00:00.000Z"),
        convertedAt: null,
        status: LeadStatus.ASSIGNED,
        outcome: null,
      },
    ];
    const [april] = computeMonthlyConversionCohorts(rows, now);
    expect(april.month).toBe("2026-04");
    expect(april.cohortSize).toBe(2);
    expect(april.d30.status).toBe("complete");
    expect(april.d60.status).toBe("complete");
    expect(april.d90.status).toBe("complete");
    if (april.d30.status === "complete") {
      expect(april.d30.converted).toBe(1);
      expect(april.d30.ratePct).toBe(50);
    }
  });

  it("marks recent cohort windows as in progress, not 0%", () => {
    const rows = [
      {
        createdAt: new Date("2026-09-02T00:00:00.000Z"),
        convertedAt: null,
        status: LeadStatus.NEW,
        outcome: null,
      },
    ];
    const [sep] = computeMonthlyConversionCohorts(rows, now);
    expect(sep.month).toBe("2026-09");
    expect(sep.d30).toEqual({ status: "in_progress" });
    expect(sep.d60).toEqual({ status: "in_progress" });
    expect(sep.d90).toEqual({ status: "in_progress" });
  });

  it("treats conversion elapsed time from createdAt to convertedAt", () => {
    const rows = [
      {
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        convertedAt: new Date("2026-03-15T00:00:00.000Z"),
        status: LeadStatus.CONVERTED,
        outcome: "WON",
      },
    ];
    const [jan] = computeMonthlyConversionCohorts(rows, now);
    if (jan.d30.status === "complete") expect(jan.d30.converted).toBe(0);
    if (jan.d60.status === "complete") expect(jan.d60.converted).toBe(0);
    if (jan.d90.status === "complete") expect(jan.d90.converted).toBe(1);
  });
});
