import type {
  NotificationPort,
  NotificationSendInput,
  NotificationSendResult,
} from "../domain/ports/NotificationPort";
import { createPrismaNotificationPort } from "./notification/notification-port";

/** B06 entry point — now delegates to the B08 DNC-gated port. */
export class InAppNotificationPort implements NotificationPort {
  async send(input: NotificationSendInput): Promise<NotificationSendResult> {
    const port = await createPrismaNotificationPort();
    return port.send(input);
  }
}
