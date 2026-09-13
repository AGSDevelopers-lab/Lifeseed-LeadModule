import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  audit: { log: vi.fn(async () => undefined) },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    notificationTemplate: { findMany: vi.fn(async () => [{ id: "t1", key: "lead.intake.welcome" }]) },
    notificationDeliveryLog: { findMany: vi.fn(async () => []) },
  },
}));

import { GET as getTemplates } from "@/app/api/leads/v2/notifications/templates/route";
import { GET as getLogs } from "@/app/api/leads/v2/notifications/delivery-log/route";
import { requirePermission } from "@/lib/rbac";

describe("B12 notification APIs", () => {
  it("GET templates requires notification.template.view", async () => {
    vi.mocked(requirePermission).mockResolvedValueOnce({
      userId: "u1",
      email: "a@b.c",
      roles: [],
      siteId: null,
      clinicId: null,
      assignments: [],
    });
    const res = await getTemplates();
    expect(res.status).toBe(200);
    expect(requirePermission).toHaveBeenCalledWith("notification.template.view");
  });

  it("GET delivery-log requires notification.log.view", async () => {
    vi.mocked(requirePermission).mockResolvedValueOnce({
      userId: "u1",
      email: "a@b.c",
      roles: [],
      siteId: null,
      clinicId: null,
      assignments: [],
    });
    const res = await getLogs(new Request("http://localhost/api/leads/v2/notifications/delivery-log"));
    expect(res.status).toBe(200);
    expect(requirePermission).toHaveBeenCalledWith("notification.log.view");
  });
});
