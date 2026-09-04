import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/leads/create-lead", () => ({
  createLeadFromIntake: vi.fn(async () => undefined),
}));

vi.mock("@/lib/sla/engine", () => ({
  runPendingChecks: vi.fn(async () => ({ checked: 0 })),
}));

vi.mock("@/lib/rbac", () => ({
  getSession: vi.fn(async () => null),
  permissionGranted: () => false,
  permissionsForRoles: () => [],
}));

import { POST as whatsappPost } from "@/app/api/leads/intake/whatsapp/route";
import { POST as slaPost } from "@/app/api/leads/sla/run/route";
import { signHmacBody } from "@/lib/security/hmac-cron";
import { signMetaBody } from "@/lib/security/meta-whatsapp-signature";

const HMAC_SECRET = "test-hmac-secret";
const STATIC_SECRET = "test-static-secret";
const META_SECRET = "test-meta-secret";

function post(url: string, headers: Record<string, string>, body: string) {
  return new NextRequest(url, { method: "POST", headers, body });
}

describe("B02 API security", () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.META_APP_SECRET = META_SECRET;
    process.env.LEAD_WHATSAPP_SIGNATURE_ENFORCED = "on";
    process.env.LEADS_CRON_HMAC_SECRET = HMAC_SECRET;
    process.env.LEADS_CRON_SECRET = STATIC_SECRET;
    process.env.LEAD_HMAC_CRON_ENFORCED = "strict";
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it("rejects unsigned WhatsApp intake with 401 HMAC_INVALID", async () => {
    const res = await whatsappPost(
      post(
        "http://localhost/api/leads/intake/whatsapp",
        { "content-type": "application/json" },
        JSON.stringify({ phone: "9999999999", text: "hi" }),
      ),
    );
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("HMAC_INVALID");
  });

  it("accepts WhatsApp intake with a valid Meta signature", async () => {
    const body = JSON.stringify({ phone: "9999999999", text: "hi" });
    const res = await whatsappPost(
      post(
        "http://localhost/api/leads/intake/whatsapp",
        {
          "content-type": "application/json",
          "x-hub-signature-256": signMetaBody(body, META_SECRET),
        },
        body,
      ),
    );
    expect(res.status).toBe(200);
  });

  it("rejects /api/leads/sla/run under strict with only the static secret", async () => {
    const res = await slaPost(
      post(
        "http://localhost/api/leads/sla/run",
        { "x-cron-secret": STATIC_SECRET },
        "{}",
      ),
    );
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("HMAC_INVALID");
  });

  it("accepts /api/leads/sla/run with a valid HMAC and rejects replay", async () => {
    const body = "{}";
    const nowMs = Date.now();
    const { header } = signHmacBody(body, HMAC_SECRET, nowMs);
    const ok = await slaPost(
      post(
        "http://localhost/api/leads/sla/run",
        { "x-lifeseed-cron-signature": header },
        body,
      ),
    );
    expect(ok.status).toBe(200);

    const stale = signHmacBody(body, HMAC_SECRET, nowMs - 400_000).header;
    const replay = await slaPost(
      post(
        "http://localhost/api/leads/sla/run",
        { "x-lifeseed-cron-signature": stale },
        body,
      ),
    );
    expect(replay.status).toBe(401);
    const json = (await replay.json()) as { error: { code: string } };
    expect(json.error.code).toBe("HMAC_REPLAY");
  });
});
