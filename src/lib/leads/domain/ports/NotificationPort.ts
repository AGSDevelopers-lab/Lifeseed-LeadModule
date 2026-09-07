import type { NotificationChannel } from "../enums";

export type NotificationSendInput = {
  channel: NotificationChannel;
  templateKey: string;
  recipient: string;
  data: Record<string, unknown>;
  leadId?: string | null;
  /** Skip the DNC block only when false AND `dncOverrideReason` is set. */
  respectDnc?: boolean;
  dncOverrideReason?: string;
};

export type NotificationSendResult =
  | { blocked: true; reason: "DNC"; deliveryId: string }
  | { blocked: false; deliveryId: string };

export interface NotificationPort {
  send(input: NotificationSendInput): Promise<NotificationSendResult>;
}
