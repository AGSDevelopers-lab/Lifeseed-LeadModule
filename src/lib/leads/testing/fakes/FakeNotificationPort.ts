import type {
  NotificationPort,
  NotificationSendInput,
} from "../../domain/ports/NotificationPort";

export class FakeNotificationPort implements NotificationPort {
  sent: NotificationSendInput[] = [];

  async send(input: NotificationSendInput): Promise<{ deliveryId: string }> {
    this.sent.push(input);
    return { deliveryId: `nd-${this.sent.length}` };
  }
}
