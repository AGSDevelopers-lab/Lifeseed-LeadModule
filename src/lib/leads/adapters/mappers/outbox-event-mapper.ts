import type { LeadOutboxEvent } from "../../domain/entities/LeadOutboxEvent";
import type { DispatchStatus, LeadEventType } from "../../domain/enums";
import { jsonRecordRequired } from "./json";

export type PrismaOutboxEventRow = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  eventVersion: number;
  payload: unknown;
  occurredAt: Date;
  enqueuedAt: Date;
  publishedAt: Date | null;
  dispatchStatus: string;
  attemptCount: number;
  lastAttemptAt: Date | null;
  lastAttemptError: string | null;
  lockedUntil: Date | null;
  lockedByWorkerId: string | null;
};

export function outboxEventToDomain(row: PrismaOutboxEventRow): LeadOutboxEvent {
  return {
    id: row.id,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    eventType: row.eventType as LeadEventType,
    eventVersion: row.eventVersion,
    payload: jsonRecordRequired(row.payload),
    occurredAt: row.occurredAt,
    enqueuedAt: row.enqueuedAt,
    publishedAt: row.publishedAt,
    dispatchStatus: row.dispatchStatus as DispatchStatus,
    attemptCount: row.attemptCount,
    lastAttemptAt: row.lastAttemptAt,
    lastAttemptError: row.lastAttemptError,
    lockedUntil: row.lockedUntil,
    lockedByWorkerId: row.lockedByWorkerId,
  };
}

export function outboxEventToPrisma(entity: LeadOutboxEvent): PrismaOutboxEventRow {
  return { ...entity };
}

export const toDomain = outboxEventToDomain;
export const toPrisma = outboxEventToPrisma;
