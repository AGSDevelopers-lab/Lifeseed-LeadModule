import { mayDispatchVendorAdapter } from "../../application/feature-flag";
import type { NotificationSendInput } from "../../domain/ports/NotificationPort";
import type { ChannelSendResult, NotificationChannelAdapter } from "./types";
import { fetchWithRetry, type RetryingFetch } from "./http-retry";

/**
 * SMS-Magic send URL is UNLOCKED (07: verify exact endpoint at build time).
 * Official REST reference was not retrievable without account access.
 * Production wiring leaves `sendUrl` unset → fail-closed, no network.
 * Tests inject a fixture URL + fake fetch only.
 */
export type SmsMagicAdapterDeps = {
  apiKey?: string;
  senderId?: string;
  sendUrl?: string;
  fetchFn?: RetryingFetch;
};

export function buildSmsMagicRequest(input: {
  apiKey: string;
  senderId: string;
  recipient: string;
  templateKey: string;
  data: Record<string, unknown>;
}): { method: "POST"; headers: Record<string, string>; body: string } {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apiKey: input.apiKey,
    },
    body: JSON.stringify({
      senderId: input.senderId,
      recipient: input.recipient,
      templateKey: input.templateKey,
      data: input.data,
    }),
  };
}

export class SmsMagicAdapter implements NotificationChannelAdapter {
  constructor(private readonly deps: SmsMagicAdapterDeps = {}) {}

  async send(input: NotificationSendInput): Promise<ChannelSendResult> {
    if (!mayDispatchVendorAdapter("SMS")) {
      throw new Error("SMS adapter I/O blocked: port mode or LEAD_SMS_ENABLED is off");
    }
    const apiKey = this.deps.apiKey ?? process.env.SMS_MAGIC_API_KEY ?? "";
    const senderId = this.deps.senderId ?? process.env.SMS_MAGIC_SENDER_ID ?? "";
    const sendUrl = this.deps.sendUrl ?? process.env.SMS_MAGIC_SEND_URL ?? "";
    if (!apiKey || !senderId || !sendUrl) {
      throw new Error(
        "SMS-Magic send URL/credentials unset — HTTP contract UNLOCKED; no network attempted",
      );
    }
    const request = buildSmsMagicRequest({
      apiKey,
      senderId,
      recipient: input.recipient,
      templateKey: input.templateKey,
      data: input.data,
    });
    const fetchFn = this.deps.fetchFn ?? fetch;
    const res = await fetchWithRetry(fetchFn, sendUrl, request);
    if (!res.ok) {
      throw new Error(`SMS-Magic HTTP ${res.status}`);
    }
    const json: unknown = await res.json().catch(() => ({}));
    const id =
      json && typeof json === "object" && "id" in json && typeof (json as { id: unknown }).id === "string"
        ? (json as { id: string }).id
        : `sms-magic-${input.templateKey}`;
    return { providerMessageId: id };
  }
}
