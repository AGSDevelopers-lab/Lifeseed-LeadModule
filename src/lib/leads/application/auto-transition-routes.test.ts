import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/leads/application/auto-transitions", () => ({
  tickCounsellingNoShows: vi.fn(async () => ({ scanned: 1, transitioned: 1 })),
  tickRetentionPurge: vi.fn(async () => ({ purged: 1 })),
}));

vi.mock("@/lib/rbac", () => ({
  getSession: vi.fn(async () => null),
  permissionGranted: () => false,
  permissionsForRoles: () => [],
}));

import { POST as counsellingTick } from "@/app/api/leads/v2/internal/counselling/tick/route";
import { POST as retentionPurge } from "@/app/api/leads/v2/internal/retention/purge/route";
import {
  tickCounsellingNoShows,
  tickRetentionPurge,
} from "@/lib/leads/application/auto-transitions";
import { signHmacBody } from "@/lib/security/hmac-cron";

const HMAC_SECRET = "test-hmac-secret";

function post(url: string, headers: Record<string, string>, body: string) {
  return new NextRequest(url, { method: "POST", headers, body });
}

describe("P0-5 HMAC auto-transition routes", () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.LEADS_CRON_HMAC_SECRET = HMAC_SECRET;
    process.env.LEAD_HMAC_CRON_ENFORCED = "strict";
    vi.mocked(tickCounsellingNoShows).mockClear();
    vi.mocked(tickRetentionPurge).mockClear();
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it("rejects unsigned counselling tick", async () => {
    const res = await counsellingTick(
      post("http://localhost/api/leads/v2/internal/counselling/tick", {}, "{}"),
    );
    expect(res.status).toBe(401);
    expect(tickCounsellingNoShows).not.toHaveBeenCalled();
  });

  it("accepts HMAC counselling tick and runs T-21 helper", async () => {
    const body = "{}";
    const { header } = signHmacBody(body, HMAC_SECRET);
    const res = await counsellingTick(
      post(
        "http://localhost/api/leads/v2/internal/counselling/tick",
        { "x-lifeseed-cron-signature": header },
        body,
      ),
    );
    expect(res.status).toBe(200);
    expect(tickCounsellingNoShows).toHaveBeenCalled();
    const json = (await res.json()) as { ok: boolean; transitioned: number };
    expect(json.ok).toBe(true);
    expect(json.transitioned).toBe(1);
  });

  it("rejects unsigned retention purge", async () => {
    const res = await retentionPurge(
      post("http://localhost/api/leads/v2/internal/retention/purge", {}, "{}"),
    );
    expect(res.status).toBe(401);
    expect(tickRetentionPurge).not.toHaveBeenCalled();
  });

  it("accepts HMAC retention purge and runs T-30 helper", async () => {
    const body = "{}";
    const { header } = signHmacBody(body, HMAC_SECRET);
    const res = await retentionPurge(
      post(
        "http://localhost/api/leads/v2/internal/retention/purge",
        { "x-lifeseed-cron-signature": header },
        body,
      ),
    );
    expect(res.status).toBe(200);
    expect(tickRetentionPurge).toHaveBeenCalled();
  });
});
