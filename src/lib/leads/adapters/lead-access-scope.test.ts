import { describe, expect, it } from "vitest";

import type { ActorContext } from "../domain/ports/shared";
import { evaluateLeadAccess, type LeadAccessSnapshot } from "./lead-access-scope";

const LEAD: LeadAccessSnapshot = {
  leadId: "lead-b",
  assignedTelecallerId: "tele-b",
  counsellorUserId: "counsellor-1",
  siteId: "site-kol",
};

function ctx(
  role: string,
  userId: string,
  siteId: string | null = "site-kol",
): ActorContext {
  return { userId, roles: [role], siteId };
}

describe("IDOR matrix — lead outside actor scope", () => {
  const cases: Array<{
    role: string;
    userId: string;
    siteId: string | null;
    expectAllow: boolean;
    denialReason?: string;
  }> = [
    {
      role: "TELECALLER",
      userId: "tele-a",
      siteId: "site-kol",
      expectAllow: false,
      denialReason: "OWNERSHIP_DENIED",
    },
    {
      role: "SR_TELECALLER",
      userId: "tele-a",
      siteId: "site-kol",
      expectAllow: false,
      denialReason: "OWNERSHIP_DENIED",
    },
    {
      role: "COUNSELLOR",
      userId: "counsellor-other",
      siteId: "site-kol",
      expectAllow: false,
      denialReason: "OWNERSHIP_DENIED",
    },
    {
      role: "OPS_MANAGER",
      userId: "ops-1",
      siteId: "site-hyd",
      expectAllow: false,
      denialReason: "SITE_SCOPE_VIOLATION",
    },
    {
      role: "MARKETING_MGR",
      userId: "mkt-1",
      siteId: "site-hyd",
      expectAllow: false,
      denialReason: "SITE_SCOPE_VIOLATION",
    },
    {
      role: "MED_DIR",
      userId: "med-1",
      siteId: "site-hyd",
      expectAllow: false,
      denialReason: "PERMISSION_DENIED",
    },
    {
      role: "BANK_MEDICAL_DIRECTOR",
      userId: "med-1",
      siteId: "site-kol",
      expectAllow: false,
      denialReason: "PERMISSION_DENIED",
    },
    {
      role: "CRM_ADMIN",
      userId: "crm-1",
      siteId: "site-kol",
      expectAllow: false,
      denialReason: "PERMISSION_DENIED",
    },
    {
      role: "BANK_SUPER_ADMIN",
      userId: "root",
      siteId: "site-hyd",
      expectAllow: true,
    },
  ];

  it.each(cases)(
    "$role outside scope → allow=$expectAllow",
    ({ role, userId, siteId, expectAllow, denialReason }) => {
      const decision = evaluateLeadAccess(LEAD, ctx(role, userId, siteId));
      expect(decision.allowed).toBe(expectAllow);
      if (!expectAllow && !decision.allowed) {
        expect(decision.denialReason).toBe(denialReason);
      }
    },
  );

  it("allows the assigned telecaller", () => {
    expect(evaluateLeadAccess(LEAD, ctx("TELECALLER", "tele-b")).allowed).toBe(
      true,
    );
  });

  it("allows the booked counsellor", () => {
    expect(
      evaluateLeadAccess(LEAD, ctx("COUNSELLOR", "counsellor-1")).allowed,
    ).toBe(true);
  });

  it("allows OPS_MANAGER on the same site", () => {
    expect(evaluateLeadAccess(LEAD, ctx("OPS_MANAGER", "ops-1")).allowed).toBe(
      true,
    );
  });
});
