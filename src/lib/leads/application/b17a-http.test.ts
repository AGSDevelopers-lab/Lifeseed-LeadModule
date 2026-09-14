import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { LeadOwnershipDeniedError } from "../domain/errors";
import { permissionGranted, permissionsForRoles } from "@/lib/rbac-permissions";

const resolveLeadActor = vi.fn();
const byId = vi.fn();
let flagOn = true;

vi.mock("@/lib/leads/adapters/identity-adapter", () => ({
  resolveLeadActor: (...args: unknown[]) => resolveLeadActor(...args),
}));

vi.mock("@/lib/leads/adapters/prisma-lead-repository", () => ({
  prismaLeadRepository: {
    byId: (...args: unknown[]) => byId(...args),
  },
}));

vi.mock("@/lib/leads/application/feature-flag", async () => {
  const actual = await vi.importActual<typeof import("./feature-flag")>("./feature-flag");
  return {
    ...actual,
    isLead360Enabled: () => flagOn,
  };
});

vi.mock("@/lib/leads/application/lead-timeline", () => ({
  listLeadTimeline: vi.fn(async () => ({ items: [], nextCursor: null })),
}));

vi.mock("@/lib/leads/application/lead-attribution-read", () => ({
  getLeadAttribution: vi.fn(async () => ({ firstTouch: null, lastTouch: null })),
}));

vi.mock("@/lib/leads/application/lead-crm-status", () => ({
  getLeadCrmStatus: vi.fn(async () => ({ syncs: [] })),
}));

vi.mock("@/lib/rbac", () => ({
  permissionGranted,
  permissionsForRoles,
}));

import { GET as timelineGet } from "@/app/api/leads/v2/leads/[id]/timeline/route";
import { GET as attrGet } from "@/app/api/leads/v2/leads/[id]/attribution/route";
import { GET as crmGet } from "@/app/api/leads/v2/leads/[id]/crm-status/route";
import { getLeadAttribution } from "./lead-attribution-read";
import { getLeadCrmStatus } from "./lead-crm-status";

const lead = {
  id: "lead-1",
  code: { toString: () => "LED-KOL-20260914-0001" },
  props: {
    personType: "DONOR",
    outcome: null,
    isArchived: false,
    source: "WEB_FORM",
    ownership: { assignedTelecallerId: "user-1", siteId: "site-kol" },
    retention: { capturedAt: new Date() },
    contact: { fullName: "A" },
    latestScore: { tier: "WARM", score: 60 },
  },
  status: "ASSIGNED",
};

function req(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe("B17-A read routes auth + flag", () => {
  beforeEach(() => {
    flagOn = true;
    resolveLeadActor.mockReset();
    byId.mockReset();
    byId.mockResolvedValue(lead);
  });
  afterEach(() => vi.clearAllMocks());

  it("returns 404 FEATURE_OFF when LEAD_360 is off", async () => {
    flagOn = false;
    resolveLeadActor.mockResolvedValue({ userId: "u1", roles: ["OPS_MANAGER"], siteId: null });
    const res = await timelineGet(req("/api/leads/v2/leads/lead-1/timeline"), {
      params: Promise.resolve({ id: "lead-1" }),
    });
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("FEATURE_OFF");
  });

  it("401 without actor", async () => {
    resolveLeadActor.mockResolvedValue(null);
    const res = await attrGet(req("/api/leads/v2/leads/lead-1/attribution"), {
      params: Promise.resolve({ id: "lead-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("403 without lead-view (crm.sync.manual alone is insufficient)", async () => {
    resolveLeadActor.mockResolvedValue({ userId: "u1", roles: ["CRM_ADMIN"], siteId: null });
    const res = await crmGet(req("/api/leads/v2/leads/lead-1/crm-status"), {
      params: Promise.resolve({ id: "lead-1" }),
    });
    expect(res.status).toBe(403);
    expect(getLeadCrmStatus).not.toHaveBeenCalled();
  });

  it("allows CRM status with lead-view and without crm.sync.manual", async () => {
    resolveLeadActor.mockResolvedValue({ userId: "u1", roles: ["TELECALLER"], siteId: null });
    const res = await crmGet(req("/api/leads/v2/leads/lead-1/crm-status"), {
      params: Promise.resolve({ id: "lead-1" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ syncs: [] });
  });

  it("IDOR: other lead ownership denied on all three routes", async () => {
    resolveLeadActor.mockResolvedValue({ userId: "u1", roles: ["TELECALLER"], siteId: null });
    byId.mockRejectedValue(
      new LeadOwnershipDeniedError("Lead not in caller scope", {
        leadId: "other",
        userId: "u1",
        denialReason: "OWNERSHIP_DENIED",
      }),
    );
    const args = { params: Promise.resolve({ id: "other" }) };
    expect((await timelineGet(req("/api/leads/v2/leads/other/timeline"), args)).status).toBe(403);
    expect((await attrGet(req("/api/leads/v2/leads/other/attribution"), args)).status).toBe(403);
    expect((await crmGet(req("/api/leads/v2/leads/other/crm-status"), args)).status).toBe(403);
    expect(getLeadAttribution).not.toHaveBeenCalled();
  });

  it("empty attribution and timeline are 200", async () => {
    resolveLeadActor.mockResolvedValue({ userId: "u1", roles: ["OPS_MANAGER"], siteId: null });
    const t = await timelineGet(req("/api/leads/v2/leads/lead-1/timeline"), {
      params: Promise.resolve({ id: "lead-1" }),
    });
    const a = await attrGet(req("/api/leads/v2/leads/lead-1/attribution"), {
      params: Promise.resolve({ id: "lead-1" }),
    });
    expect(t.status).toBe(200);
    expect(await t.json()).toEqual({ items: [], nextCursor: null });
    expect(a.status).toBe(200);
    expect(await a.json()).toEqual({ firstTouch: null, lastTouch: null });
  });
});
