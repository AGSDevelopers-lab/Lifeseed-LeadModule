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

  const viewRoles: Array<{
    role: string;
    ownOk: boolean;
    otherStatus: number;
    otherCode?: string;
  }> = [
    { role: "TELECALLER", ownOk: true, otherStatus: 403, otherCode: "OWNERSHIP_DENIED" },
    { role: "SR_TELECALLER", ownOk: true, otherStatus: 403, otherCode: "OWNERSHIP_DENIED" },
    { role: "COUNSELLOR", ownOk: true, otherStatus: 403, otherCode: "OWNERSHIP_DENIED" },
    { role: "OPS_MANAGER", ownOk: true, otherStatus: 200 },
    { role: "MARKETING_MGR", ownOk: true, otherStatus: 200 },
    { role: "CRM_ADMIN", ownOk: false, otherStatus: 403, otherCode: "PERMISSION_DENIED" },
    { role: "BANK_SUPER_ADMIN", ownOk: true, otherStatus: 200 },
    { role: "BANK_MEDICAL_DIRECTOR", ownOk: false, otherStatus: 403, otherCode: "PERMISSION_DENIED" },
  ];

  it.each(viewRoles)(
    "$role detail own vs other",
    async ({ role, ownOk, otherStatus, otherCode }) => {
      resolveLeadActor.mockResolvedValue(actor(role, "user-1"));
      byId.mockImplementation(async (id: string) => {
        if (
          id === OTHER &&
          (role === "TELECALLER" || role === "SR_TELECALLER" || role === "COUNSELLOR")
        ) {
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
      expect(other.status).toBe(otherStatus);
      if (otherStatus === 403 && otherCode) {
        const otherJson = (await other.json()) as { error: { code: string } };
        expect(otherJson.error.code).toBe(otherCode);
      }
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

  it("lead.convert.approve is granted only to OPS_MANAGER and BANK_SUPER_ADMIN", () => {
    const roles = Object.keys(ROLE_PERMISSIONS) as UserRole[];
    for (const r of roles) {
      const granted = ROLE_PERMISSIONS[r].includes("lead.convert.approve");
      if (r === "OPS_MANAGER" || r === "BANK_SUPER_ADMIN") {
        expect(granted).toBe(true);
      } else {
        expect(granted).toBe(false);
      }
    }
  });
});
