import type { LeadOutboxEvent } from "../../domain/entities/LeadOutboxEvent";
import { DispatchStatus } from "../../domain/enums";
import {
  OUTBOX_LEASE_MS,
  isFailedRetryDue,
  type OutboxRepository,
} from "../../application/outbox-types";

function cloneEvent(row: LeadOutboxEvent): LeadOutboxEvent {
  return { ...row, payload: { ...row.payload } };
}

function isClaimable(row: LeadOutboxEvent, now: Date): boolean {
  if (row.dispatchStatus === DispatchStatus.PENDING) {
    return row.lockedUntil == null || row.lockedUntil.getTime() <= now.getTime();
  }
  if (row.dispatchStatus === DispatchStatus.IN_FLIGHT) {
    return row.lockedUntil == null || row.lockedUntil.getTime() <= now.getTime();
  }
  if (row.dispatchStatus === DispatchStatus.FAILED) {
    return isFailedRetryDue(row.attemptCount, row.lastAttemptAt, now);
  }
  return false;
}

export class InMemoryOutboxRepository implements OutboxRepository {
  readonly events = new Map<string, LeadOutboxEvent>();
  readonly dlq: Array<{
    originalEventId: string;
    failureReason: string;
    attempts: number;
    movedAt: Date;
  }> = [];
  claimCalls = 0;

  seed(row: LeadOutboxEvent): void {
    this.events.set(row.id, cloneEvent(row));
  }

  snapshot(): LeadOutboxEvent[] {
    return [...this.events.values()].map(cloneEvent);
  }

  async claimDue(input: {
    batchSize: number;
    workerId: string;
    now: Date;
  }): Promise<LeadOutboxEvent[]> {
    this.claimCalls += 1;
    const lockedUntil = new Date(input.now.getTime() + OUTBOX_LEASE_MS);
    const open = [...this.events.values()].filter(
      (e) =>
        e.dispatchStatus !== DispatchStatus.PUBLISHED &&
        e.dispatchStatus !== DispatchStatus.DEAD,
    );
    const earliestByAgg = new Map<string, LeadOutboxEvent>();
    for (const row of open) {
      const prev = earliestByAgg.get(row.aggregateId);
      if (
        !prev ||
        row.occurredAt.getTime() < prev.occurredAt.getTime() ||
        (row.occurredAt.getTime() === prev.occurredAt.getTime() && row.id < prev.id)
      ) {
        earliestByAgg.set(row.aggregateId, row);
      }
    }
    const due = [...earliestByAgg.values()]
      .filter((row) => isClaimable(row, input.now))
      .sort((a, b) => a.enqueuedAt.getTime() - b.enqueuedAt.getTime())
      .slice(0, input.batchSize);

    const claimed: LeadOutboxEvent[] = [];
    for (const row of due) {
      const next: LeadOutboxEvent = {
        ...row,
        dispatchStatus: DispatchStatus.IN_FLIGHT,
        lockedUntil,
        lockedByWorkerId: input.workerId,
      };
      this.events.set(row.id, next);
      claimed.push(cloneEvent(next));
    }
    return claimed;
  }

  async markPublished(id: string, now: Date): Promise<void> {
    const row = this.events.get(id);
    if (!row) return;
    this.events.set(id, {
      ...row,
      dispatchStatus: DispatchStatus.PUBLISHED,
      publishedAt: now,
      lastAttemptAt: now,
      lastAttemptError: null,
      lockedUntil: null,
      lockedByWorkerId: null,
    });
  }

  async markFailed(input: {
    id: string;
    attemptCount: number;
    error: string;
    now: Date;
  }): Promise<void> {
    const row = this.events.get(input.id);
    if (!row) return;
    this.events.set(input.id, {
      ...row,
      dispatchStatus: DispatchStatus.FAILED,
      attemptCount: input.attemptCount,
      lastAttemptAt: input.now,
      lastAttemptError: input.error,
      lockedUntil: null,
      lockedByWorkerId: null,
    });
  }

  async moveToDlq(input: {
    event: LeadOutboxEvent;
    failureReason: string;
    attempts: number;
    now: Date;
  }): Promise<void> {
    const row = this.events.get(input.event.id);
    if (row) {
      this.events.set(input.event.id, {
        ...row,
        dispatchStatus: DispatchStatus.DEAD,
        attemptCount: input.attempts,
        lastAttemptAt: input.now,
        lastAttemptError: input.failureReason,
        lockedUntil: null,
        lockedByWorkerId: null,
      });
    }
    this.dlq.push({
      originalEventId: input.event.id,
      failureReason: input.failureReason,
      attempts: input.attempts,
      movedAt: input.now,
    });
  }
}
