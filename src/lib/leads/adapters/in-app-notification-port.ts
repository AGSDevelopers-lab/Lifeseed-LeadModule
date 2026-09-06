import type {
  NotificationPort,
  NotificationSendInput,
} from "../domain/ports/NotificationPort";

/** B06 stub: in-app only. Real email/SMS/WhatsApp adapters land in B12. */
export class InAppNotificationPort implements NotificationPort {
  async send(input: NotificationSendInput): Promise<{ deliveryId: string }> {
    console.info(
      JSON.stringify({
        msg: "lead_in_app_notification_enqueued",
        channel: input.channel,
        templateKey: input.templateKey,
        recipient: input.recipient,
        leadId: input.leadId ?? null,
        outboxEventId:
          typeof input.data.outboxEventId === "string" ? input.data.outboxEventId : null,
      }),
    );
    const id =
      typeof input.data.outboxEventId === "string"
        ? `in-app-${input.data.outboxEventId}`
        : `in-app-${input.templateKey}`;
    return { deliveryId: id };
  }
}
