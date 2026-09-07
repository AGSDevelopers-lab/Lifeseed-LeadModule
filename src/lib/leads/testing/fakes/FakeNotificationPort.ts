import type {
  NotificationPort,
  NotificationSendInput,
  NotificationSendResult,
} from "../../domain/ports/NotificationPort";

export class FakeNotificationPort implements NotificationPort {
  sent: NotificationSendInput[] = [];

  async send(input: NotificationSendInput): Promise<NotificationSendResult> {
    this.sent.push(input);
    return { blocked: false, deliveryId: `nd-${this.sent.length}` };
  }
}
