import type { NotificationSendInput } from "../../domain/ports/NotificationPort";

export type ChannelSendResult = { providerMessageId: string };

export interface NotificationChannelAdapter {
  send(input: NotificationSendInput): Promise<ChannelSendResult>;
}
