import { describe, expect, it } from "vitest";

import { leadListScopeWhere } from "./lead-access-scope";

describe("leadListScopeWhere (P0-1)", () => {
  it("scopes TELECALLER to assigneeId", () => {
    expect(
      leadListScopeWhere({ userId: "t-a", roles: ["TELECALLER"], siteId: "s1" }),
    ).toEqual({ assignedTelecallerId: "t-a" });
  });

  it("scopes COUNSELLOR to booked counsellor", () => {
    expect(
      leadListScopeWhere({ userId: "c1", roles: ["COUNSELLOR"] }),
    ).toEqual({ counsellingBooking: { is: { counsellorUserId: "c1" } } });
  });

  it("site-scopes OPS_MANAGER", () => {
    expect(
      leadListScopeWhere({ userId: "ops", roles: ["OPS_MANAGER"], siteId: "s1" }),
    ).toEqual({ assignedTelecaller: { siteId: "s1" } });
  });

  it("does not filter BANK_SUPER_ADMIN", () => {
    expect(
      leadListScopeWhere({ userId: "sa", roles: ["BANK_SUPER_ADMIN"] }),
    ).toEqual({});
  });

  it("returns empty-scope sentinel when role has no Lead view", () => {
    expect(
      leadListScopeWhere({ userId: "x", roles: ["BANK_FINANCE"] }),
    ).toEqual({ id: "__no_lead_scope__" });
  });

  it("returns empty-scope sentinel for BANK_MEDICAL_DIRECTOR (LADR-25)", () => {
    expect(
      leadListScopeWhere({
        userId: "md",
        roles: ["BANK_MEDICAL_DIRECTOR"],
        siteId: "s1",
      }),
    ).toEqual({ id: "__no_lead_scope__" });
  });

  it("returns empty-scope sentinel for CRM_ADMIN (no case-level view)", () => {
    expect(
      leadListScopeWhere({ userId: "crm", roles: ["CRM_ADMIN"], siteId: "s1" }),
    ).toEqual({ id: "__no_lead_scope__" });
  });

  it("site-scopes MARKETING_MGR via MARKETING_MANAGER mapping", () => {
    expect(
      leadListScopeWhere({
        userId: "mkt",
        roles: ["MARKETING_MGR"],
        siteId: "s1",
      }),
    ).toEqual({ assignedTelecaller: { siteId: "s1" } });
  });

  it("scopes SR_TELECALLER to assigneeId", () => {
    expect(
      leadListScopeWhere({ userId: "sr", roles: ["SR_TELECALLER"], siteId: "s1" }),
    ).toEqual({ assignedTelecallerId: "sr" });
  });
});
