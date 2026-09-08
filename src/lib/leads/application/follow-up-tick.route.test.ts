import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/leads/application/follow-up", async () => {
  const actual = await vi.importActual<typeof import("@/lib/leads/application/follow-up")>(
    "@/lib/leads/application/follow-up",
  );
  return {
    ...actual,
    liveFollowUpDeps: vi.fn(async () => ({
      store: actual.createMemoryFollowUpStore(),
      clock: { now: () => new Date("2026-09-08T12:00:00.000Z") },
      ids: { next: () => "id" },
      sla: { schedule: async () => "sla", complete: async () => undefined },
      policy: { defaultDueHours: 24, overdueGraceMinutes: 0 },
      persistPrisma: false,
    })),
    tickFollowUps: vi.fn(async () => ({ markedDue: 1, markedOverdue: 0, slaBreaches: 0 })),
  };
});

vi.mock("@/lib/rbac", () => ({
  getSession: vi.fn(async () => null),
  permissionGranted: () => false,
  permissionsForRoles: () => [],
}));

import { POST as tickPost } from "@/app/api/leads/v2/internal/follow-ups/tick/route";
import { tickFollowUps } from "@/lib/leads/application/follow-up";
import { signHmacBody } from "@/lib/security/hmac-cron";

const HMAC_SECRET = "test-hmac-secret";

function post(url: string, headers: Record<string, string>, body: string) {
  return new NextRequest(url, { method: "POST", headers, body });
}

describe("B10 follow-up tick HMAC route", () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.LEADS_CRON_HMAC_SECRET = HMAC_SECRET;
    process.env.LEAD_HMAC_CRON_ENFORCED = "strict";
    process.env.LEAD_FOLLOWUP_ENABLED = "on";
    vi.mocked(tickFollowUps).mockClear();
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it("rejects unsigned ticks", async () => {
    const res = await tickPost(
      post("http://localhost/api/leads/v2/internal/follow-ups/tick", {}, "{}"),
    );
    expect(res.status).toBe(401);
    expect(tickFollowUps).not.toHaveBeenCalled();
  });

  it("accepts a valid HMAC and ticks follow-ups", async () => {
    const body = "{}";
    const { header } = signHmacBody(body, HMAC_SECRET);
    const res = await tickPost(
      post(
        "http://localhost/api/leads/v2/internal/follow-ups/tick",
        { "x-lifeseed-cron-signature": header },
        body,
      ),
    );
    expect(res.status).toBe(200);
    expect(tickFollowUps).toHaveBeenCalled();
  });
});
