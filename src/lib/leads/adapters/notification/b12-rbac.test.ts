import { describe, expect, it } from "vitest";

import { permissionGranted, permissionsForRoles } from "@/lib/rbac-permissions";

describe("B12 notification RBAC", () => {
  it("wires frozen notification.template.view without new permissions", () => {
    expect(
      permissionGranted(permissionsForRoles(["MARKETING_MANAGER"]), "notification.template.view"),
    ).toBe(true);
    expect(
      permissionGranted(permissionsForRoles(["OPS_MANAGER"]), "notification.log.view"),
    ).toBe(true);
    expect(
      permissionGranted(permissionsForRoles(["TELECALLER"]), "notification.template.view"),
    ).toBe(false);
    expect(
      permissionGranted(permissionsForRoles(["BANK_SUPER_ADMIN"]), "notification.template.approve"),
    ).toBe(true);
  });
});
