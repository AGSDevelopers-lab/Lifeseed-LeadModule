import type { DeliveryStatus, NotificationChannel, NotificationProvider } from "../enums";

export interface NotificationDeliveryLog {
  id: string;
  leadId: string | null;
  templateId: string;
  channel: NotificationChannel;
  provider: NotificationProvider;
  recipient: string;
  sentAt: Date;
  providerMessageId: string | null;
  deliveryStatus: DeliveryStatus;
  statusUpdatedAt: Date | null;
  failureReason: string | null;
  dncCheckedAt: Date;
  dncPassed: boolean;
  payloadHash: string | null;
}
