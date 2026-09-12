import { describe, expect, it } from "vitest";

import { mergeLeadListFilters } from "./lead-access-scope";

describe("CONFLICT-28 KPI filters", () => {
  it("encodes SLA due-before as slaResponseDueAt lte", () => {
    const due = new Date("2026-09-12T12:00:00.000Z");
    const where = mergeLeadListFilters({}, { slaResponseDueBefore: due });
    expect(where.slaResponseDueAt).toEqual({ lte: due });
  });

  it("encodes converted-today as convertedAt gte", () => {
    const start = new Date("2026-09-12T00:00:00.000Z");
    const where = mergeLeadListFilters({}, { convertedAtFrom: start, status: "CONVERTED" });
    expect(where.convertedAt).toEqual({ gte: start });
    expect(where.status).toBe("CONVERTED");
  });
});
