import { LeadStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  countFunnelStage,
  FUNNEL_CONTACTED_STATUSES,
  FUNNEL_COUNSELLED_STATUSES,
} from "../application/funnel-status-groups";
import { mergeLeadListFilters } from "./lead-access-scope";

describe("CONFLICT-27 funnel multi-status OR vs rowset", () => {
  const rowset: Array<{ status: LeadStatus }> = [
    { status: LeadStatus.NEW },
    { status: LeadStatus.CONTACTED_QUALIFIED },
    { status: LeadStatus.CONTACTED_NOT_INTERESTED },
    { status: LeadStatus.COUNSELLING_BOOKED },
    { status: LeadStatus.COUNSELLING_ATTENDED },
    { status: LeadStatus.CONVERTED },
  ];

  it("contacted OR count matches explicit rowset filter", () => {
    const fromRows = countFunnelStage(rowset, FUNNEL_CONTACTED_STATUSES);
    expect(fromRows).toBe(5);
    const where = mergeLeadListFilters({}, { statuses: FUNNEL_CONTACTED_STATUSES });
    expect(where.status).toEqual({ in: FUNNEL_CONTACTED_STATUSES });
  });

  it("counselled OR count matches explicit rowset filter", () => {
    expect(countFunnelStage(rowset, FUNNEL_COUNSELLED_STATUSES)).toBe(2);
  });
});
