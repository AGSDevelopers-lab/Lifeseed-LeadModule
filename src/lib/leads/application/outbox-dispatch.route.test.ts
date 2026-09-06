import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/leads/application/outbox-dispatcher", () => ({
  dispatchPending: vi.fn(async () => ({
    skipped: true,
    claimed: 0,
    published: 0,
    failed: 0,
    dead: 0,
    workerId: "test-worker",
  })),
}));

vi.mock("@/lib/rbac", () => ({
  getSession: vi.fn(async () => null),
  permissionGranted: () => false,
  permissionsForRoles: () => [],
}));

import { POST as dispatchPost } from "@/app/api/leads/v2/internal/outbox/dispatch/route";
import { signHmacBody } from "@/lib/security/hmac-cron";
import { dispatchPending } from "@/lib/leads/application/outbox-dispatcher";

const HMAC_SECRET = "test-hmac-secret";

function post(url: string, headers: Record<string, string>, body: string) {
  return new NextRequest(url, { method: "POST", headers, body });
}

describe("B06 outbox dispatch HMAC route", () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.LEADS_CRON_HMAC_SECRET = HMAC_SECRET;
    process.env.LEAD_HMAC_CRON_ENFORCED = "strict";
    vi.mocked(dispatchPending).mockClear();
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it("rejects unsigned ticks", async () => {
    const res = await dispatchPost(
      post("http://localhost/api/leads/v2/internal/outbox/dispatch", {}, "{}"),
    );
    expect(res.status).toBe(401);
    expect(dispatchPending).not.toHaveBeenCalled();
  });

  it("accepts a valid HMAC and calls dispatchPending", async () => {
    const body = "{}";
    const { header } = signHmacBody(body, HMAC_SECRET);
    const res = await dispatchPost(
      post(
        "http://localhost/api/leads/v2/internal/outbox/dispatch",
        { "x-lifeseed-cron-signature": header },
        body,
      ),
    );
    expect(res.status).toBe(200);
    expect(dispatchPending).toHaveBeenCalledWith(50, {});
    const json = (await res.json()) as { skipped: boolean };
    expect(json.skipped).toBe(true);
  });
});
