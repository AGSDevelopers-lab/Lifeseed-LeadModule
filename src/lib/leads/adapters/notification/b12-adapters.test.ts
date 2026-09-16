import { afterEach, describe, expect, it, vi } from "vitest";

import { buildSmsMagicRequest, SmsMagicAdapter } from "./sms-magic-adapter";
import { buildResendEmailRequest, ResendEmailAdapter } from "./resend-email-adapter";
import { buildMetaWhatsappRequest, MetaWhatsappAdapter } from "./meta-whatsapp-adapter";
import { fetchWithRetry, TransientHttpError } from "./http-retry";
import { NotificationChannel } from "../../domain/enums";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
  vi.unstubAllGlobals();
});

const sendInput = {
  channel: NotificationChannel.SMS,
  templateKey: "lead.intake.welcome",
  recipient: "+919876543210",
  data: { body: "{{body}}" },
};

describe("B12 adapters (mocked HTTP)", () => {
  it("SMS-Magic constructs a request without inventing a locked URL", () => {
    const req = buildSmsMagicRequest({
      apiKey: "k",
      senderId: "LS",
      recipient: "+91",
      templateKey: "t",
      data: {},
    });
    expect(req.headers.apiKey).toBe("k");
    expect(JSON.parse(req.body)).toMatchObject({ senderId: "LS" });
  });

  it("SMS-Magic performs no network when send URL unset even if flags on", async () => {
    process.env.LEAD_NOTIFICATION_PORT_ENABLED = "on";
    process.env.LEAD_SMS_ENABLED = "on";
    const fetchFn = vi.fn();
    const adapter = new SmsMagicAdapter({
      apiKey: "k",
      senderId: "LS",
      sendUrl: "",
      fetchFn: fetchFn as never,
    });
    await expect(adapter.send({ ...sendInput, channel: NotificationChannel.SMS })).rejects.toThrow(
      /UNLOCKED/,
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("SMS-Magic uses injected fixture URL + fake fetch when flags on", async () => {
    process.env.LEAD_NOTIFICATION_PORT_ENABLED = "on";
    process.env.LEAD_SMS_ENABLED = "on";
    const fetchFn = vi.fn(async (...args: any[]) =>
      new Response(JSON.stringify({ id: "sm-1" }), { status: 200 }),
    );
    const adapter = new SmsMagicAdapter({
      apiKey: "k",
      senderId: "LS",
      sendUrl: "https://sms-magic.test.invalid/fixture-send",
      fetchFn: fetchFn as never,
    });
    const result = await adapter.send({ ...sendInput, channel: NotificationChannel.SMS });
    expect(result.providerMessageId).toBe("sm-1");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain("sms-magic.test.invalid");
  });

  it("SMS-Magic flag off never fetches", async () => {
    process.env.LEAD_NOTIFICATION_PORT_ENABLED = "on";
    process.env.LEAD_SMS_ENABLED = "off";
    const fetchFn = vi.fn();
    const adapter = new SmsMagicAdapter({
      apiKey: "k",
      senderId: "LS",
      sendUrl: "https://sms-magic.test.invalid/fixture-send",
      fetchFn: fetchFn as never,
    });
    await expect(adapter.send({ ...sendInput, channel: NotificationChannel.SMS })).rejects.toThrow(
      /LEAD_SMS_ENABLED/,
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("Resend builds official send URL and uses mock fetch", async () => {
    process.env.LEAD_NOTIFICATION_PORT_ENABLED = "on";
    process.env.LEAD_EMAIL_ENABLED = "on";
    const built = buildResendEmailRequest({
      apiKey: "re_test",
      from: "a@b.c",
      to: "c@d.e",
      templateKey: "t",
      data: { body: "{{body}}", subject: "s" },
    });
    expect(built.url).toBe("https://api.resend.com/emails");
    const fetchFn = vi.fn(async (...args: any[]) => new Response(JSON.stringify({ id: "re_1" }), { status: 200 }));
    const adapter = new ResendEmailAdapter({ apiKey: "re_test", from: "a@b.c", fetchFn: fetchFn as never });
    const result = await adapter.send({
      ...sendInput,
      channel: NotificationChannel.EMAIL,
      recipient: "c@d.e",
    });
    expect(result.providerMessageId).toBe("re_1");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("Meta WhatsApp builds Graph URL and uses mock fetch", async () => {
    process.env.LEAD_NOTIFICATION_PORT_ENABLED = "on";
    process.env.LEAD_WHATSAPP_ENABLED = "on";
    const built = buildMetaWhatsappRequest({
      token: "t",
      phoneId: "123",
      graphVersion: "v21.0",
      to: "91",
      templateKey: "t",
      data: { body: "{{body}}" },
    });
    expect(built.url).toBe("https://graph.facebook.com/v21.0/123/messages");
    const fetchFn = vi.fn(
      async (...args: any[]) => new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 }),
    );
    const adapter = new MetaWhatsappAdapter({
      token: "t",
      phoneId: "123",
      fetchFn: fetchFn as never,
    });
    const result = await adapter.send({
      ...sendInput,
      channel: NotificationChannel.WHATSAPP,
    });
    expect(result.providerMessageId).toBe("wamid.1");
  });

  it("retries on 429 then succeeds", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const res = await fetchWithRetry(fetchFn as never, "https://example.invalid", { method: "POST" });
    expect(res.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("exhausts retries on 500", async () => {
    const fetchFn = vi.fn(async () => new Response("err", { status: 500 }));
    await expect(
      fetchWithRetry(fetchFn as never, "https://example.invalid", { method: "GET" }, { maxAttempts: 3 }),
    ).rejects.toBeInstanceOf(TransientHttpError);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});
