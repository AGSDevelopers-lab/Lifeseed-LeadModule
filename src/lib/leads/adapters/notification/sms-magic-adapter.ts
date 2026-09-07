import type { NotificationSendInput } from "../../domain/ports/NotificationPort";
import type { ChannelSendResult, NotificationChannelAdapter } from "./types";

/** Stub — real SMS-Magic wiring is B12 (LADR-16: SMS-Magic behind port only). */
export class SmsMagicAdapter implements NotificationChannelAdapter {
  async send(input: NotificationSendInput): Promise<ChannelSendResult> {
    console.info(
      JSON.stringify({
        msg: "lead_sms_magic_stub",
        templateKey: input.templateKey,
        recipient: input.recipient,
        leadId: input.leadId ?? null,
      }),
    );
    return { providerMessageId: `stub-sms-magic-${input.templateKey}` };
  }
}
