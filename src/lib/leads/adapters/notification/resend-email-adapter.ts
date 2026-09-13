import { mayDispatchVendorAdapter } from "../../application/feature-flag";
import type { NotificationSendInput } from "../../domain/ports/NotificationPort";
import type { ChannelSendResult, NotificationChannelAdapter } from "./types";
import { fetchWithRetry, type RetryingFetch } from "./http-retry";

const RESEND_SEND_URL = "https://api.resend.com/emails";

export type ResendEmailAdapterDeps = {
  apiKey?: string;
  from?: string;
  fetchFn?: RetryingFetch;
};

export function buildResendEmailRequest(input: {
  apiKey: string;
  from: string;
  to: string;
  templateKey: string;
  data: Record<string, unknown>;
}): { url: string; method: "POST"; headers: Record<string, string>; body: string } {
  const subject =
    typeof input.data.subject === "string" ? input.data.subject : input.templateKey;
  const html =
    typeof input.data.body === "string" ? input.data.body : JSON.stringify(input.data);
  return {
    url: RESEND_SEND_URL,
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject,
      html,
    }),
  };
}

export class ResendEmailAdapter implements NotificationChannelAdapter {
  constructor(private readonly deps: ResendEmailAdapterDeps = {}) {}

  async send(input: NotificationSendInput): Promise<ChannelSendResult> {
    if (!mayDispatchVendorAdapter("EMAIL")) {
      throw new Error("Email adapter I/O blocked: port mode or LEAD_EMAIL_ENABLED is off");
    }
    const apiKey = this.deps.apiKey ?? process.env.RESEND_API_KEY ?? "";
    if (!apiKey) {
      throw new Error("RESEND_API_KEY unset; no network attempted");
    }
    const from =
      this.deps.from ?? process.env.RESEND_FROM_EMAIL ?? "LifeSeed <noreply@lifeseed.local>";
    const request = buildResendEmailRequest({
      apiKey,
      from,
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
      throw new Error(`Resend HTTP ${res.status}`);
    }
    const json: unknown = await res.json().catch(() => ({}));
    const id =
      json && typeof json === "object" && "id" in json && typeof (json as { id: unknown }).id === "string"
        ? (json as { id: string }).id
        : `resend-${input.templateKey}`;
    return { providerMessageId: id };
  }
}
