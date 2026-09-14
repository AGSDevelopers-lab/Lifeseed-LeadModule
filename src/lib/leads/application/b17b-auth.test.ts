import { describe, expect, it } from "vitest";

import { permissionGranted, permissionsForRoles } from "@/lib/rbac-permissions";

describe("B17-B authorization matrices (existing permissions only)", () => {
  it("audit.view granted to ops/marketing/crm/super-admin; denied to telecaller", () => {
    expect(permissionGranted(permissionsForRoles(["BANK_SUPER_ADMIN"]), "audit.view")).toBe(true);
    expect(permissionGranted(permissionsForRoles(["OPS_MANAGER"]), "audit.view")).toBe(true);
    expect(permissionGranted(permissionsForRoles(["MARKETING_MANAGER"]), "audit.view")).toBe(true);
    expect(permissionGranted(permissionsForRoles(["CRM_ADMIN"]), "audit.view")).toBe(true);
    expect(permissionGranted(permissionsForRoles(["TELECALLER"]), "audit.view")).toBe(false);
  });

  it("audit.export remains BANK_SUPER_ADMIN only", () => {
    expect(permissionGranted(permissionsForRoles(["BANK_SUPER_ADMIN"]), "audit.export")).toBe(true);
    expect(permissionGranted(permissionsForRoles(["OPS_MANAGER"]), "audit.export")).toBe(false);
  });

  it("telecaller.disposition is held by TELECALLER (queue write path)", () => {
    expect(permissionGranted(permissionsForRoles(["TELECALLER"]), "telecaller.disposition")).toBe(true);
  });

  it("lead.list allows admin list; TELECALLER does not hold lead.list", () => {
    expect(permissionGranted(permissionsForRoles(["OPS_MANAGER"]), "lead.list")).toBe(true);
    expect(permissionGranted(permissionsForRoles(["TELECALLER"]), "lead.list")).toBe(false);
  });
});
