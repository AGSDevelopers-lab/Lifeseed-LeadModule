import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermission = vi.fn();
const listDuplicateCases = vi.fn();
const getDuplicateCase = vi.fn();
const mergeDuplicateCase = vi.fn();
const keepSeparateDuplicateCase = vi.fn();
const dismissDuplicateCase = vi.fn();
const resolveLeadActor = vi.fn();

vi.mock("@/lib/rbac", () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
}));

vi.mock("@/lib/leads/application/feature-flag", () => ({
  isLeadDuplicateEnabled: () => true,
}));

vi.mock("@/lib/leads/application/duplicate", () => ({
  listDuplicateCases: (...args: unknown[]) => listDuplicateCases(...args),
  getDuplicateCase: (...args: unknown[]) => getDuplicateCase(...args),
  keepSeparateDuplicateCase: (...args: unknown[]) => keepSeparateDuplicateCase(...args),
  dismissDuplicateCase: (...args: unknown[]) => dismissDuplicateCase(...args),
}));

vi.mock("@/lib/leads/application/merge", () => ({
  mergeDuplicateCase: (...args: unknown[]) => mergeDuplicateCase(...args),
}));

vi.mock("@/lib/leads/adapters/identity-adapter", () => ({
  resolveLeadActor: (...args: unknown[]) => resolveLeadActor(...args),
}));

import { GET as listGet } from "@/app/api/leads/v2/duplicates/route";
import { GET as detailGet } from "@/app/api/leads/v2/duplicates/[id]/route";
import { POST as mergePost } from "@/app/api/leads/v2/duplicates/[id]/merge/route";
import { POST as keepPost } from "@/app/api/leads/v2/duplicates/[id]/keep-separate/route";
import { POST as dismissPost } from "@/app/api/leads/v2/duplicates/[id]/dismiss/route";

const actor = { userId: "ops", roles: ["OPS_MANAGER"], siteId: "s1" };

function jsonReq(url: string, body?: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("B14 /v2/duplicates APIs", () => {
  beforeEach(() => {
    requirePermission.mockReset();
    listDuplicateCases.mockReset();
    getDuplicateCase.mockReset();
    mergeDuplicateCase.mockReset();
    keepSeparateDuplicateCase.mockReset();
    dismissDuplicateCase.mockReset();
    resolveLeadActor.mockReset();
    requirePermission.mockResolvedValue({ userId: "ops", roles: ["OPS_MANAGER"] });
    resolveLeadActor.mockResolvedValue(actor);
    listDuplicateCases.mockResolvedValue([]);
    getDuplicateCase.mockResolvedValue({
      case: { id: "c1", leftLeadId: "l1", rightLeadId: "l2" },
      left: { id: "l1" },
      right: { id: "l2" },
    });
    mergeDuplicateCase.mockResolvedValue({ mergeId: "m1" });
    keepSeparateDuplicateCase.mockResolvedValue({ id: "c1", reviewStatus: "KEPT_SEPARATE" });
    dismissDuplicateCase.mockResolvedValue({ id: "c1", reviewStatus: "DISMISSED" });
  });

  it("GET list calls duplicate.review and listDuplicateCases", async () => {
    const res = await listGet(new Request("http://x/api/leads/v2/duplicates"));
    expect(res.status).toBe(200);
    expect(requirePermission).toHaveBeenCalledWith("duplicate.review");
    expect(listDuplicateCases).toHaveBeenCalled();
  });

  it("GET pair detail calls duplicate.review and getDuplicateCase", async () => {
    const res = await detailGet(new Request("http://x/api/leads/v2/duplicates/c1"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(200);
    expect(requirePermission).toHaveBeenCalledWith("duplicate.review");
    expect(getDuplicateCase).toHaveBeenCalledWith("c1");
  });

  it("POST merge calls lead.merge and mergeDuplicateCase", async () => {
    const res = await mergePost(
      jsonReq("http://x/api/leads/v2/duplicates/c1/merge", {
        winnerLeadId: "l1",
        reason: "same person",
        strategy: "COPY_ALL",
      }),
      { params: Promise.resolve({ id: "c1" }) },
    );
    expect(res.status).toBe(200);
    expect(requirePermission).toHaveBeenCalledWith("lead.merge");
    expect(mergeDuplicateCase).toHaveBeenCalled();
  });

  it("POST keep-separate calls duplicate.review", async () => {
    const res = await keepPost(jsonReq("http://x/keep", { notes: "n" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(200);
    expect(requirePermission).toHaveBeenCalledWith("duplicate.review");
    expect(keepSeparateDuplicateCase).toHaveBeenCalled();
  });

  it("POST dismiss calls duplicate.review", async () => {
    const res = await dismissPost(jsonReq("http://x/dismiss", { notes: "n" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(200);
    expect(requirePermission).toHaveBeenCalledWith("duplicate.review");
    expect(dismissDuplicateCase).toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    requirePermission.mockRejectedValue(
      new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 }),
    );
    const res = await listGet(new Request("http://x/api/leads/v2/duplicates"));
    expect(res.status).toBe(401);
  });
});
