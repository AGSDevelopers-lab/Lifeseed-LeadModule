import type { NotificationSendInput } from "../../domain/ports/NotificationPort";
import type { ChannelSendResult, NotificationChannelAdapter } from "./types";

/** Stub — real Resend wiring is B12. */
export class ResendEmailAdapter implements NotificationChannelAdapter {
  async send(input: NotificationSendInput): Promise<ChannelSendResult> {
    console.info(
      JSON.stringify({
        msg: "lead_resend_email_stub",
        templateKey: input.templateKey,
        recipient: input.recipient,
        leadId: input.leadId ?? null,
      }),
    );
    return { providerMessageId: `stub-resend-${input.templateKey}` };
  }
}
