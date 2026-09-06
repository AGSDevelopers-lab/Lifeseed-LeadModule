import { LEAD_EVENT_TYPES } from "../../domain/events";
import type { LeadEventType } from "../../domain/enums";
import type { LeadOutboxEvent } from "../../domain/entities/LeadOutboxEvent";
import type { OutboxConsumer } from "../outbox-types";

const counters = new Map<string, number>();

function key(eventType: LeadEventType): string {
  return `lead_outbox_events_total{event_type="${eventType}"}`;
}

export function resetAnalyticsCounters(): void {
  counters.clear();
}

export function incrementOutboxCounter(eventType: LeadEventType, n = 1): void {
  const k = key(eventType);
  counters.set(k, (counters.get(k) ?? 0) + n);
}

export function getOutboxCounter(eventType: LeadEventType): number {
  return counters.get(key(eventType)) ?? 0;
}

export function renderPrometheusMetrics(): string {
  const lines = [
    "# HELP lead_outbox_events_total Domain events dispatched from the lead outbox",
    "# TYPE lead_outbox_events_total counter",
  ];
  for (const eventType of LEAD_EVENT_TYPES) {
    lines.push(`${key(eventType)} ${getOutboxCounter(eventType)}`);
  }
  return `${lines.join("\n")}\n`;
}

export function createAnalyticsConsumer(): OutboxConsumer {
  return {
    name: "analytics",
    async handle(event: LeadOutboxEvent): Promise<void> {
      incrementOutboxCounter(event.eventType);
    },
  };
}
