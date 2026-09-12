import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { LeadOwnershipDeniedError } from "../domain/errors";
import { ROLE_PERMISSIONS, permissionGranted, permissionsForRoles } from "@/lib/rbac-permissions";
import type { UserRole } from "@prisma/client";

const resolveLeadActor = vi.fn();
const byId = vi.fn();
const list = vi.fn();
const recordView = vi.fn();

vi.mock("@/lib/leads/adapters/identity-adapter", () => ({
  resolveLeadActor: (...args: unknown[]) => resolveLeadActor(...args),
}));

vi.mock("@/lib/leads/adapters/prisma-lead-repository", () => ({
  prismaLeadRepository: {
    byId: (...args: unknown[]) => byId(...args),
    list: (...args: unknown[]) => list(...args),
  },
}));

vi.mock("@/lib/leads/adapters/prisma-audit", () => ({
  prismaLeadAudit: {
    recordView: (...args: unknown[]) => recordView(...args),
    recordDenied: vi.fn(),
  },
}));

vi.mock("@/lib/rbac", () => ({
  permissionGranted,
  permissionsForRoles,
}));

import { GET as listGet } from "@/app/api/leads/v2/leads/route";
import { GET as detailGet } from "@/app/api/leads/v2/leads/[id]/route";

const OWN = "lead-own";
const OTHER = "lead-other";

function actor(role: string, userId: string, siteId: string | null = "site-kol") {
  return { userId, roles: [role], siteId };
}

async function detail(id: string) {
  return detailGet(new NextRequest(`http://localhost/api/leads/v2/leads/${id}`), {
    params: Promise.resolve({ id }),
  });
}

describe("CONFLICT-30 HTTP two-actor IDOR (GET list/detail)", () => {
  beforeEach(() => {
    resolveLeadActor.mockReset();
    byId.mockReset();
    list.mockReset();
    recordView.mockReset();
    list.mockResolvedValue({ items: [], nextCursor: null });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  const viewRoles: Array<{ role: string; ownOk: boolean; otherCode: string }> = [
    { role: "TELECALLER", ownOk: true, otherCode: "OWNERSHIP_DENIED" },
    { role: "SR_TELECALLER", ownOk: false, otherCode: "PERMISSION_DENIED" },
    { role: "COUNSELLOR", ownOk: true, otherCode: "OWNERSHIP_DENIED" },
    { role: "OPS_MANAGER", ownOk: true, otherCode: "OWNERSHIP_DENIED" },
    { role: "MARKETING_MANAGER", ownOk: true, otherCode: "OWNERSHIP_DENIED" },
    { role: "MARKETING_MGR", ownOk: false, otherCode: "PERMISSION_DENIED" },
    { role: "CRM_ADMIN", ownOk: true, otherCode: "OWNERSHIP_DENIED" },
    { role: "BANK_SUPER_ADMIN", ownOk: true, otherCode: "OWNERSHIP_DENIED" },
    { role: "BANK_MEDICAL_DIRECTOR", ownOk: false, otherCode: "PERMISSION_DENIED" },
  ];

  it.each(viewRoles)(
    "$role detail own vs other",
    async ({ role, ownOk, otherCode }) => {
      resolveLeadActor.mockResolvedValue(actor(role, "user-1"));
      byId.mockImplementation(async (id: string) => {
        if (id === OTHER && role !== "BANK_SUPER_ADMIN") {
          throw new LeadOwnershipDeniedError("Lead not in caller scope", {
            leadId: id,
            userId: "user-1",
            denialReason: "OWNERSHIP_DENIED",
          });
        }
        return {
          id,
          code: { toString: () => "LED-KOL-20260912-0001" },
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
      });

      const own = await detail(OWN);
      if (ownOk) {
        expect(own.status).toBe(200);
      } else {
        expect(own.status).toBe(403);
        const json = (await own.json()) as { error: { code: string } };
        expect(json.error.code).toBe("PERMISSION_DENIED");
      }

      const other = await detail(OTHER);
      if (role === "BANK_SUPER_ADMIN") {
        expect(other.status).toBe(200);
        return;
      }
      expect(other.status).toBe(403);
      const otherJson = (await other.json()) as { error: { code: string } };
      expect(otherJson.error.code).toBe(otherCode);
    },
  );

  it("list is actor-scoped for TELECALLER", async () => {
    resolveLeadActor.mockResolvedValue(actor("TELECALLER", "tele-a"));
    const res = await listGet(new NextRequest("http://localhost/api/leads/v2/leads"));
    expect(res.status).toBe(200);
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "tele-a", roles: ["TELECALLER"] }),
      expect.any(Object),
    );
  });

  it("ROLE_PERMISSIONS still has no lead.convert.approve (BATCH 3)", () => {
    const roles = Object.keys(ROLE_PERMISSIONS) as UserRole[];
    for (const r of roles) {
      expect(ROLE_PERMISSIONS[r].includes("lead.convert.approve")).toBe(false);
    }
  });
});
