import { describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";

import {
  ROLE_PERMISSIONS,
  canonicalizeUserRole,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac-permissions";

const EIGHT: UserRole[] = [
  "TELECALLER",
  "SR_TELECALLER",
  "COUNSELLOR",
  "OPS_MANAGER",
  "MARKETING_MANAGER",
  "CRM_ADMIN",
  "BANK_MEDICAL_DIRECTOR",
  "BANK_SUPER_ADMIN",
];

function holds(role: UserRole, perm: string): boolean {
  return permissionGranted(ROLE_PERMISSIONS[role], perm);
}

describe("P0-2 permission matrix vs 05 §4.4 (post LADR-24/25)", () => {
  it("maps MARKETING_MGR to MARKETING_MANAGER", () => {
    expect(canonicalizeUserRole("MARKETING_MGR")).toBe("MARKETING_MANAGER");
    expect(permissionsForRoles(["MARKETING_MGR"])).toEqual(
      ROLE_PERMISSIONS.MARKETING_MANAGER,
    );
  });

  it("grants lead.convert.approve only to OPS_MANAGER and BANK_SUPER_ADMIN", () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as UserRole[]) {
      expect(holds(role, "lead.convert.approve")).toBe(
        role === "OPS_MANAGER" || role === "BANK_SUPER_ADMIN",
      );
    }
  });

  it("does not grant case-level Lead view to BANK_MEDICAL_DIRECTOR or CRM_ADMIN", () => {
    for (const role of ["BANK_MEDICAL_DIRECTOR", "CRM_ADMIN"] as const) {
      expect(holds(role, "lead.view.any")).toBe(false);
      expect(holds(role, "lead.view.own")).toBe(false);
      expect(holds(role, "lead.view")).toBe(false);
      expect(holds(role, "lead.list")).toBe(false);
      expect(holds(role, "lead.config.view")).toBe(true);
    }
  });

  it("grants SR_TELECALLER own-pool extras without view.any", () => {
    expect(holds("SR_TELECALLER", "lead.view.own")).toBe(true);
    expect(holds("SR_TELECALLER", "lead.reassign")).toBe(true);
    expect(holds("SR_TELECALLER", "lead.reactivate")).toBe(true);
    expect(holds("SR_TELECALLER", "lead.view.any")).toBe(false);
    expect(holds("SR_TELECALLER", "lead.convert.approve")).toBe(false);
  });

  it("covers the eight CONFLICT-30 roles in ROLE_PERMISSIONS", () => {
    for (const role of EIGHT) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });
});
