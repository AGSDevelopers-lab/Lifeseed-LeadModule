import type { NotificationSendInput } from "../../domain/ports/NotificationPort";
import type { ChannelSendResult, NotificationChannelAdapter } from "./types";

/** Stub — real Meta WhatsApp wiring is B12. */
export class MetaWhatsappAdapter implements NotificationChannelAdapter {
  async send(input: NotificationSendInput): Promise<ChannelSendResult> {
    console.info(
      JSON.stringify({
        msg: "lead_meta_whatsapp_stub",
        templateKey: input.templateKey,
        recipient: input.recipient,
        leadId: input.leadId ?? null,
      }),
    );
    return { providerMessageId: `stub-meta-wa-${input.templateKey}` };
  }
}
