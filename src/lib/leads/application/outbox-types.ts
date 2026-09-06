import type { LeadOutboxEvent } from "../domain/entities/LeadOutboxEvent";

export const OUTBOX_RETRY_LADDER_MS = [
  30_000,
  2 * 60_000,
  10 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
] as const;

export const OUTBOX_MAX_ATTEMPTS = 5;
export const OUTBOX_LEASE_MS = 60_000;

export type OutboxConsumerName = "crm" | "notification" | "analytics";

export type OutboxConsumer = {
  name: OutboxConsumerName;
  handle(event: LeadOutboxEvent, ctx: { now: Date }): Promise<void>;
};

export type DispatchSummary = {
  skipped: boolean;
  claimed: number;
  published: number;
  failed: number;
  dead: number;
  workerId: string;
};

export type OutboxDlqInsert = {
  originalEventId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  failureReason: string;
  attempts: number;
  movedAt: Date;
};

export type OutboxRepository = {
  claimDue(input: {
    batchSize: number;
    workerId: string;
    now: Date;
  }): Promise<LeadOutboxEvent[]>;
  markPublished(id: string, now: Date): Promise<void>;
  markFailed(input: {
    id: string;
    attemptCount: number;
    error: string;
    now: Date;
  }): Promise<void>;
  moveToDlq(input: {
    event: LeadOutboxEvent;
    failureReason: string;
    attempts: number;
    now: Date;
  }): Promise<void>;
};

export function retryDelayMs(attemptCount: number): number {
  const idx = Math.min(Math.max(attemptCount, 1), OUTBOX_RETRY_LADDER_MS.length) - 1;
  return OUTBOX_RETRY_LADDER_MS[idx];
}

export function nextRetryAt(attemptCount: number, now: Date): Date {
  return new Date(now.getTime() + retryDelayMs(attemptCount));
}

export function isFailedRetryDue(
  attemptCount: number,
  lastAttemptAt: Date | null,
  now: Date,
): boolean {
  if (lastAttemptAt == null) return true;
  return lastAttemptAt.getTime() + retryDelayMs(attemptCount) <= now.getTime();
}
