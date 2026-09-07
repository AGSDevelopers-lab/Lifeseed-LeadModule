import type { NotificationSendInput } from "../../domain/ports/NotificationPort";
import type { ChannelSendResult, NotificationChannelAdapter } from "./types";

type InAppStore = {
  notificationInApp: {
    create: (args: object) => Promise<{ id: string }>;
  };
};

export class InAppNotificationAdapter implements NotificationChannelAdapter {
  constructor(private readonly store: InAppStore) {}

  async send(input: NotificationSendInput): Promise<ChannelSendResult> {
    const title =
      typeof input.data.title === "string" ? input.data.title : input.templateKey;
    const body =
      typeof input.data.body === "string"
        ? input.data.body
        : typeof input.data.summary === "string"
          ? input.data.summary
          : input.templateKey;
    const row = await this.store.notificationInApp.create({
      data: {
        recipientUserId: input.recipient,
        title,
        body,
        leadId: input.leadId ?? null,
        templateKey: input.templateKey,
        payload: input.data,
      },
    });
    return { providerMessageId: row.id };
  }
}
