import type { NotificationChannel } from "../enums";

export type NotificationSendInput = {
  channel: NotificationChannel;
  templateKey: string;
  recipient: string;
  data: Record<string, unknown>;
  leadId?: string | null;
};

export interface NotificationPort {
  send(input: NotificationSendInput): Promise<{ deliveryId: string }>;
}
