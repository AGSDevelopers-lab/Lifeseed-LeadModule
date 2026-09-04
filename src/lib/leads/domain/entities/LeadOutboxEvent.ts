import type { DispatchStatus, LeadEventType } from "../enums";

export interface LeadOutboxEvent {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: LeadEventType;
  eventVersion: number;
  payload: Record<string, unknown>;
  occurredAt: Date;
  enqueuedAt: Date;
  publishedAt: Date | null;
  dispatchStatus: DispatchStatus;
  attemptCount: number;
  lastAttemptAt: Date | null;
  lastAttemptError: string | null;
  lockedUntil: Date | null;
  lockedByWorkerId: string | null;
}
