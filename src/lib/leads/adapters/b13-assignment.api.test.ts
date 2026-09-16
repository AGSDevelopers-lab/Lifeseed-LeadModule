import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermission = vi.fn((...args: any[]) => undefined as any);
const listAvailableTelecallers = vi.fn((...args: any[]) => undefined as any);
const loadAssignmentRules = vi.fn(async (...args: any[]) => ({
  maxQueuePerTelecaller: 20,
  autoAssignEnabled: true,
  openStatuses: ["NEW"],
  siteMatchingPolicy: "require_match",
  crossSiteOverridePolicy: "assignment_override",
  rotationStrategy: "least_open_then_user_id",
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: (...args: any[]) => requirePermission(...args),
}));

vi.mock("@/lib/leads/adapters/prisma-assignment-directory", () => ({
  createPrismaAssignmentDirectory: async () => ({
    listAvailableTelecallers: (...args: any[]) => listAvailableTelecallers(...args),
  }),
  loadAssignmentRules: (...args: any[]) => loadAssignmentRules(...args),
}));

import { GET as directoryGet } from "@/app/api/leads/v2/assignment/directory/route";
import { GET as workloadGet } from "@/app/api/leads/v2/assignment/workload/route";

describe("B13 assignment APIs", () => {
  beforeEach(() => {
    requirePermission.mockReset();
    listAvailableTelecallers.mockReset();
    requirePermission.mockResolvedValue({ userId: "ops", roles: ["OPS_MANAGER"] });
    listAvailableTelecallers.mockResolvedValue([
      { userId: "tc1", siteId: "s1", openLeadCount: 2, languages: [], skills: [] },
    ]);
  });

  it("GET /v2/assignment/directory returns fallback fields with empty languages/skills", async () => {
    const res = await directoryGet();
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      items: Array<{ languages: string[]; skills: string[] }>;
    };
    expect(json.items[0].languages).toEqual([]);
    expect(json.items[0].skills).toEqual([]);
  });

  it("GET /v2/assignment/workload returns capacity and site buckets", async () => {
    const res = await workloadGet();
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      maxQueuePerTelecaller: number;
      bySite: Array<{ telecallers: number }>;
    };
    expect(json.maxQueuePerTelecaller).toBe(20);
    expect(json.bySite[0].telecallers).toBe(1);
  });

  it("rejects unauthenticated callers", async () => {
    requirePermission.mockRejectedValue(
      new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 }),
    );
    const res = await directoryGet();
    expect(res.status).toBe(401);
  });
});
