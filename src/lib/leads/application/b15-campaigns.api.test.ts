import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermission = vi.fn();
const listCampaigns = vi.fn();
const createCampaign = vi.fn();
const getCampaign = vi.fn();
const patchCampaign = vi.fn();
const activateCampaign = vi.fn();
const endCampaign = vi.fn();
const computeCampaignCac = vi.fn();
const resolveLeadActor = vi.fn();

vi.mock("@/lib/rbac", () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));

vi.mock("@/lib/leads/adapters/identity-adapter", () => ({
  resolveLeadActor: (...args: unknown[]) => resolveLeadActor(...args),
}));

vi.mock("@/lib/leads/application/campaign", () => ({
  listCampaigns: (...args: unknown[]) => listCampaigns(...args),
  createCampaign: (...args: unknown[]) => createCampaign(...args),
  getCampaign: (...args: unknown[]) => getCampaign(...args),
  patchCampaign: (...args: unknown[]) => patchCampaign(...args),
  activateCampaign: (...args: unknown[]) => activateCampaign(...args),
  endCampaign: (...args: unknown[]) => endCampaign(...args),
}));

vi.mock("@/lib/leads/application/attribution", () => ({
  computeCampaignCac: (...args: unknown[]) => computeCampaignCac(...args),
}));

import { GET as listGet, POST as createPost } from "@/app/api/leads/v2/campaigns/route";
import { GET as getOne, PATCH as patchOne } from "@/app/api/leads/v2/campaigns/[id]/route";
import { POST as activatePost } from "@/app/api/leads/v2/campaigns/[id]/activate/route";
import { POST as endPost } from "@/app/api/leads/v2/campaigns/[id]/end/route";
import { GET as cacGet } from "@/app/api/leads/v2/analytics/cac/route";

const actor = { userId: "mkt", roles: ["MARKETING_MANAGER"], siteId: "s1" };

function jsonReq(url: string, body?: unknown, method = "POST") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("B15 campaign + CAC HTTP routes", () => {
  beforeEach(() => {
    requirePermission.mockReset();
    listCampaigns.mockReset();
    createCampaign.mockReset();
    getCampaign.mockReset();
    patchCampaign.mockReset();
    activateCampaign.mockReset();
    endCampaign.mockReset();
    computeCampaignCac.mockReset();
    resolveLeadActor.mockReset();
    requirePermission.mockResolvedValue({ userId: "mkt", roles: ["MARKETING_MANAGER"] });
    resolveLeadActor.mockResolvedValue(actor);
    listCampaigns.mockResolvedValue([]);
    createCampaign.mockResolvedValue({ id: "c1", status: "DRAFT" });
    getCampaign.mockResolvedValue({ id: "c1" });
    patchCampaign.mockResolvedValue({ id: "c1", status: "PAUSED" });
    activateCampaign.mockResolvedValue({ id: "c1", status: "ACTIVE" });
    endCampaign.mockResolvedValue({ id: "c1", status: "ENDED" });
    computeCampaignCac.mockResolvedValue([]);
  });

  it("GET /v2/campaigns requires campaign.view", async () => {
    const res = await listGet();
    expect(res.status).toBe(200);
    expect(requirePermission).toHaveBeenCalledWith("campaign.view");
    expect(listCampaigns).toHaveBeenCalled();
  });

  it("POST /v2/campaigns requires campaign.create", async () => {
    const res = await createPost(
      jsonReq("http://x/api/leads/v2/campaigns", {
        name: "N",
        code: "CODE1",
        source: "WEB_FORM",
        startAt: new Date().toISOString(),
      }),
    );
    expect(res.status).toBe(201);
    expect(requirePermission).toHaveBeenCalledWith("campaign.create");
  });

  it("GET /v2/campaigns/{id} requires campaign.view", async () => {
    const res = await getOne(new Request("http://x/c1"), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(200);
    expect(requirePermission).toHaveBeenCalledWith("campaign.view");
  });

  it("PATCH /v2/campaigns/{id} requires campaign.edit", async () => {
    const res = await patchOne(jsonReq("http://x/c1", { status: "PAUSED" }, "PATCH"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(200);
    expect(requirePermission).toHaveBeenCalledWith("campaign.edit");
  });

  it("POST activate requires campaign.activate", async () => {
    const res = await activatePost(jsonReq("http://x/activate"), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(200);
    expect(requirePermission).toHaveBeenCalledWith("campaign.activate");
  });

  it("POST end requires campaign.end", async () => {
    const res = await endPost(jsonReq("http://x/end"), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(200);
    expect(requirePermission).toHaveBeenCalledWith("campaign.end");
  });

  it("GET /v2/analytics/cac requires analytics.view", async () => {
    const res = await cacGet(new Request("http://x/api/leads/v2/analytics/cac?scope=donor"));
    expect(res.status).toBe(200);
    expect(requirePermission).toHaveBeenCalledWith("analytics.view");
    expect(computeCampaignCac).toHaveBeenCalled();
  });

  it("rejects unauthenticated campaign list", async () => {
    requirePermission.mockRejectedValue(
      new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 }),
    );
    const res = await listGet();
    expect(res.status).toBe(401);
  });
});
