import { NotificationChannel } from "../../domain/enums";
import type { LeadEventType } from "../../domain/enums";
import type { LeadOutboxEvent } from "../../domain/entities/LeadOutboxEvent";
import type { NotificationPort } from "../../domain/ports/NotificationPort";
import type { OutboxConsumer } from "../outbox-types";

export const NOTIFICATION_EVENT_TYPES = [
  "LeadAssigned",
  "CounsellingBooked",
  "LeadFollowUpCreated",
] as const satisfies readonly LeadEventType[];

const TEMPLATE_BY_EVENT: Record<(typeof NOTIFICATION_EVENT_TYPES)[number], string> = {
  LeadAssigned: "lead.assigned.in_app",
  CounsellingBooked: "counselling.booked.in_app",
  LeadFollowUpCreated: "followup.created.in_app",
};

function isNotifiable(
  eventType: LeadEventType,
): eventType is (typeof NOTIFICATION_EVENT_TYPES)[number] {
  return (NOTIFICATION_EVENT_TYPES as readonly string[]).includes(eventType);
}

function recipientFor(event: LeadOutboxEvent): string {
  const payload = event.payload;
  const keys = ["assigneeUserId", "counsellorUserId", "actorUserId", "ownerUserId"] as const;
  for (const k of keys) {
    const v = payload[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return "SYSTEM";
}

export function createNotificationConsumer(port: NotificationPort): OutboxConsumer {
  return {
    name: "notification",
    async handle(event: LeadOutboxEvent): Promise<void> {
      if (!isNotifiable(event.eventType)) return;
      await port.send({
        channel: NotificationChannel.IN_APP,
        templateKey: TEMPLATE_BY_EVENT[event.eventType],
        recipient: recipientFor(event),
        leadId: event.aggregateId,
        data: {
          outboxEventId: event.id,
          eventType: event.eventType,
          ...event.payload,
        },
      });
    },
  };
}
