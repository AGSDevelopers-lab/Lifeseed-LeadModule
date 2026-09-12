import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/leads/adapters/config-store-adapter", () => ({
  getConfigStoreAdapter: () => ({}),
}));
vi.mock("@/lib/leads/application/config-store", () => ({
  resolveConfigPayload: async () => ({ leadUnconvertedDays: 365 }),
}));
vi.mock("@/lib/leads/config/flag", () => ({
  getLeadConfigMode: () => "on",
}));
vi.mock("@/lib/leads/application/backfill-lead-conversions", () => ({
  resolveSystemUserId: async () => "sys",
}));
vi.mock("@/lib/leads/adapters/prisma-lead-analytics", () => ({
  listLeadIdsByStatus: vi.fn(async () => ["lead-1"]),
  countNoShowSessions: vi.fn(async () => 3),
  listExpiredLeadIds: vi.fn(async () => ["lead-exp"]),
}));
vi.mock("@/lib/leads/application/apply-lead-event", () => ({
  applyLeadEvent: vi.fn(async () => ({ lead: null, result: { transitionId: "T-21" } })),
}));
vi.mock("@/lib/leads/application/commands", () => ({
  expireLeadV2: vi.fn(async () => ({ lead: null, result: { transitionId: "T-30" } })),
}));

import { applyLeadEvent } from "@/lib/leads/application/apply-lead-event";
import { expireLeadV2 } from "@/lib/leads/application/commands";
import {
  tickCounsellingNoShows,
  tickRetentionPurge,
} from "./auto-transitions";

describe("P0-5 auto-transitions", () => {
  it("routes counselling no-show exhaustion through SM mark_lost (T-21)", async () => {
    const summary = await tickCounsellingNoShows();
    expect(summary.transitioned).toBe(1);
    expect(applyLeadEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: "lead-1",
        event: "mark_lost",
        forcePersist: true,
      }),
    );
  });

  it("routes retention purge through expireLeadV2 (T-30)", async () => {
    const summary = await tickRetentionPurge();
    expect(summary.purged).toBe(1);
    expect(expireLeadV2).toHaveBeenCalledWith(
      "lead-exp",
      expect.objectContaining({ roles: ["BANK_SUPER_ADMIN"] }),
      { forcePersist: true },
    );
  });
});
