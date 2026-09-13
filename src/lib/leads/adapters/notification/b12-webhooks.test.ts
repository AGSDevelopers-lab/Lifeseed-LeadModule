import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  prisma: {
    notificationDeliveryLog: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  audit: { log: vi.fn(async () => undefined) },
}));

import { POST as smsPost } from "@/app/api/leads/v2/notifications/webhook/sms-magic/route";
import { POST as metaPost } from "@/app/api/leads/v2/notifications/webhook/meta/route";
import { POST as resendPost } from "@/app/api/leads/v2/notifications/webhook/resend/route";
import { signHmacSha256Hex } from "@/lib/leads/adapters/notification/hmac-raw-body";
import { signResendSvix } from "@/lib/leads/adapters/notification/resend-svix";
import { signMetaBody } from "@/lib/security/meta-whatsapp-signature";
import { prisma } from "@/lib/db";

const env = { ...process.env };

beforeEach(() => {
  process.env.SMS_MAGIC_WEBHOOK_SECRET = "sms-secret";
  process.env.META_APP_SECRET = "meta-secret";
  process.env.LEAD_WHATSAPP_SIGNATURE_ENFORCED = "on";
  process.env.RESEND_WEBHOOK_SECRET = "resend-secret";
  vi.mocked(prisma.notificationDeliveryLog.updateMany).mockClear();
});

afterEach(() => {
  process.env = { ...env };
});

describe("B12 delivery webhooks", () => {
  it("rejects unsigned SMS-Magic webhook", async () => {
    const res = await smsPost(
      new Request("http://localhost/api/leads/v2/notifications/webhook/sms-magic", {
        method: "POST",
        body: JSON.stringify({ messageId: "x", status: "delivered" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("updates delivery log on valid SMS-Magic HMAC", async () => {
    const body = JSON.stringify({ messageId: "sm-1", status: "delivered" });
    const res = await smsPost(
      new Request("http://localhost/api/leads/v2/notifications/webhook/sms-magic", {
        method: "POST",
        headers: { "x-sms-magic-signature": signHmacSha256Hex("sms-secret", body) },
        body,
      }),
    );
    expect(res.status).toBe(200);
    expect(prisma.notificationDeliveryLog.updateMany).toHaveBeenCalled();
  });

  it("rejects unsigned Meta delivery webhook", async () => {
    const res = await metaPost(
      new Request("http://localhost/api/leads/v2/notifications/webhook/meta", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("accepts Meta-signed status payload", async () => {
    const body = JSON.stringify({
      entry: [
        {
          changes: [
            { value: { statuses: [{ id: "wamid.1", status: "delivered" }] } },
          ],
        },
      ],
    });
    const res = await metaPost(
      new Request("http://localhost/api/leads/v2/notifications/webhook/meta", {
        method: "POST",
        headers: { "x-hub-signature-256": signMetaBody(body, "meta-secret") },
        body,
      }),
    );
    expect(res.status).toBe(200);
    expect(prisma.notificationDeliveryLog.updateMany).toHaveBeenCalled();
  });

  it("rejects unsigned Resend webhook", async () => {
    const res = await resendPost(
      new Request("http://localhost/api/leads/v2/notifications/webhook/resend", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("maps Resend bounce with Svix signature", async () => {
    const body = JSON.stringify({
      type: "email.bounced",
      data: { email_id: "re_1" },
    });
    const id = "msg_1";
    const ts = "123";
    const res = await resendPost(
      new Request("http://localhost/api/leads/v2/notifications/webhook/resend", {
        method: "POST",
        headers: {
          "svix-id": id,
          "svix-timestamp": ts,
          "svix-signature": signResendSvix("resend-secret", id, ts, body),
        },
        body,
      }),
    );
    expect(res.status).toBe(200);
    expect(prisma.notificationDeliveryLog.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deliveryStatus: "BOUNCED" }),
      }),
    );
  });
});
