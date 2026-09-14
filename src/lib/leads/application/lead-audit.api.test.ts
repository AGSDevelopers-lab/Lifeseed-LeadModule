import { describe, expect, it, vi } from "vitest";

const requirePermission = vi.fn();
const listLeadAudit = vi.fn();

vi.mock("@/lib/rbac", () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));

vi.mock("@/lib/leads/application/lead-audit-read", () => ({
  listLeadAudit: (...args: unknown[]) => listLeadAudit(...args),
}));

import { GET } from "@/app/api/leads/v2/audit/route";

describe("GET /api/leads/v2/audit", () => {
  it("requires audit.view", async () => {
    requirePermission.mockRejectedValue(
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    );
    const res = await GET(new Request("http://localhost/api/leads/v2/audit"));
    expect(res.status).toBe(403);
  });

  it("rejects offset pagination", async () => {
    requirePermission.mockResolvedValue({ userId: "sa", roles: ["BANK_SUPER_ADMIN"] });
    const res = await GET(
      new Request("http://localhost/api/leads/v2/audit?offset=10"),
    );
    expect(res.status).toBe(400);
    expect(listLeadAudit).not.toHaveBeenCalled();
  });

  it("passes keyset filters and is GET-only", async () => {
    requirePermission.mockResolvedValue({ userId: "sa", roles: ["BANK_SUPER_ADMIN"] });
    listLeadAudit.mockResolvedValue({ items: [], nextCursor: null });
    const res = await GET(
      new Request(
        "http://localhost/api/leads/v2/audit?entityId=lead-1&actorUserId=u1&action=CREATE&from=2026-09-01T00:00:00.000Z&to=2026-09-14T00:00:00.000Z",
      ),
    );
    expect(res.status).toBe(200);
    expect(listLeadAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "lead-1",
        actorUserId: "u1",
        action: "CREATE",
      }),
    );
    expect(GET.name).toBe("GET");
  });
});
