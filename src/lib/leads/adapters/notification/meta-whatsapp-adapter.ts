import { mayDispatchVendorAdapter } from "../../application/feature-flag";
import type { NotificationSendInput } from "../../domain/ports/NotificationPort";
import type { ChannelSendResult, NotificationChannelAdapter } from "./types";
import { fetchWithRetry, type RetryingFetch } from "./http-retry";

export type MetaWhatsappAdapterDeps = {
  token?: string;
  phoneId?: string;
  graphVersion?: string;
  fetchFn?: RetryingFetch;
};

export function buildMetaWhatsappRequest(input: {
  token: string;
  phoneId: string;
  graphVersion: string;
  to: string;
  templateKey: string;
  data: Record<string, unknown>;
}): { url: string; method: "POST"; headers: Record<string, string>; body: string } {
  const version = input.graphVersion.replace(/^\/+/, "");
  const url = `https://graph.facebook.com/${version}/${input.phoneId}/messages`;
  const bodyText =
    typeof input.data.body === "string" ? input.data.body : input.templateKey;
  return {
    url,
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: input.to,
      type: "text",
      text: { body: bodyText },
    }),
  };
}

export class MetaWhatsappAdapter implements NotificationChannelAdapter {
  constructor(private readonly deps: MetaWhatsappAdapterDeps = {}) {}

  async send(input: NotificationSendInput): Promise<ChannelSendResult> {
    if (!mayDispatchVendorAdapter("WHATSAPP")) {
      throw new Error("WhatsApp adapter I/O blocked: port mode or LEAD_WHATSAPP_ENABLED is off");
    }
    const token = this.deps.token ?? process.env.META_WHATSAPP_TOKEN ?? "";
    const phoneId = this.deps.phoneId ?? process.env.META_WHATSAPP_PHONE_ID ?? "";
    const graphVersion =
      this.deps.graphVersion ?? process.env.META_WHATSAPP_GRAPH_VERSION ?? "v21.0";
    if (!token || !phoneId) {
      throw new Error("META_WHATSAPP_TOKEN/PHONE_ID unset; no network attempted");
    }
    const request = buildMetaWhatsappRequest({
      token,
      phoneId,
      graphVersion,
      to: input.recipient,
      templateKey: input.templateKey,
      data: input.data,
    });
    const fetchFn = this.deps.fetchFn ?? fetch;
    const res = await fetchWithRetry(fetchFn, request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    if (!res.ok) {
      throw new Error(`Meta WhatsApp HTTP ${res.status}`);
    }
    const json: unknown = await res.json().catch(() => ({}));
    const idFromMessages =
      json &&
      typeof json === "object" &&
      "messages" in json &&
      Array.isArray((json as { messages: unknown }).messages)
        ? (json as { messages: Array<{ id?: string }> }).messages[0]?.id
        : undefined;
    return { providerMessageId: idFromMessages ?? `meta-wa-${input.templateKey}` };
  }
}
