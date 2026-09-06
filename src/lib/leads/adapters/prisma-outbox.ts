import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { LeadOutboxEvent } from "../domain/entities/LeadOutboxEvent";
import { DispatchStatus } from "../domain/enums";
import { OUTBOX_LEASE_MS, type OutboxRepository } from "../application/outbox-types";
import { outboxEventToDomain } from "./mappers/outbox-event-mapper";
import { LEAD_INTERACTIVE_TX_OPTIONS } from "./prisma-lead-repository";

/** Exported so tests can assert SKIP LOCKED is in the claim path. */
export const OUTBOX_CLAIM_LOCK_SQL = `FOR UPDATE OF e SKIP LOCKED`;

export type OutboxMonitorStats = {
  pendingCount: number;
  inFlightCount: number;
  failedCount: number;
  publishedCount: number;
  deadCount: number;
  dlqCount: number;
  pendingLagSeconds: number | null;
  lastPublishedAt: Date | null;
  lastDispatchAt: Date | null;
};

type OutboxDb = Pick<PrismaClient, "$transaction" | "$queryRaw" | "$executeRaw"> & {
  leadOutboxEvent: {
    update: PrismaClient["leadOutboxEvent"]["update"];
    updateMany: PrismaClient["leadOutboxEvent"]["updateMany"];
    aggregate: PrismaClient["leadOutboxEvent"]["aggregate"];
    count: PrismaClient["leadOutboxEvent"]["count"];
    findMany: PrismaClient["leadOutboxEvent"]["findMany"];
  };
  leadOutboxDlq: {
    create: PrismaClient["leadOutboxDlq"]["create"];
    count: PrismaClient["leadOutboxDlq"]["count"];
  };
};

export class PrismaOutboxRepository implements OutboxRepository {
  constructor(private readonly db: OutboxDb = prisma as unknown as OutboxDb) {}

  async claimDue(input: {
    batchSize: number;
    workerId: string;
    now: Date;
  }): Promise<LeadOutboxEvent[]> {
    const lockedUntil = new Date(input.now.getTime() + OUTBOX_LEASE_MS);
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
        WITH next_open AS (
          SELECT DISTINCT ON ("aggregateId") id
          FROM "LeadOutboxEvent"
          WHERE "dispatchStatus" NOT IN ('PUBLISHED'::"DispatchStatus", 'DEAD'::"DispatchStatus")
          ORDER BY "aggregateId", "occurredAt" ASC, id ASC
        )
        SELECT e.*
        FROM "LeadOutboxEvent" e
        INNER JOIN next_open n ON n.id = e.id
        WHERE
          e."dispatchStatus" = 'PENDING'::"DispatchStatus"
          OR (
            e."dispatchStatus" = 'IN_FLIGHT'::"DispatchStatus"
            AND (e."lockedUntil" IS NULL OR e."lockedUntil" < ${input.now})
          )
          OR (
            e."dispatchStatus" = 'FAILED'::"DispatchStatus"
            AND (
              e."lastAttemptAt" IS NULL
              OR e."lastAttemptAt" + (
                CASE
                  WHEN e."attemptCount" <= 1 THEN INTERVAL '30 seconds'
                  WHEN e."attemptCount" = 2 THEN INTERVAL '2 minutes'
                  WHEN e."attemptCount" = 3 THEN INTERVAL '10 minutes'
                  WHEN e."attemptCount" = 4 THEN INTERVAL '1 hour'
                  ELSE INTERVAL '6 hours'
                END
              ) <= ${input.now}
            )
          )
        ORDER BY e."enqueuedAt" ASC
        LIMIT ${input.batchSize}
        ${Prisma.raw(OUTBOX_CLAIM_LOCK_SQL)}
      `);

      if (rows.length === 0) return [];

      const ids = rows.map((r) => String(r.id));
      await tx.leadOutboxEvent.updateMany({
        where: { id: { in: ids } },
        data: {
          dispatchStatus: DispatchStatus.IN_FLIGHT,
          lockedUntil,
          lockedByWorkerId: input.workerId,
        },
      });

      return rows.map((row) =>
        outboxEventToDomain({
          ...row,
          id: String(row.id),
          aggregateType: String(row.aggregateType),
          aggregateId: String(row.aggregateId),
          eventType: String(row.eventType),
          eventVersion: Number(row.eventVersion),
          payload: row.payload,
          occurredAt: row.occurredAt as Date,
          enqueuedAt: row.enqueuedAt as Date,
          publishedAt: (row.publishedAt as Date | null) ?? null,
          dispatchStatus: DispatchStatus.IN_FLIGHT,
          attemptCount: Number(row.attemptCount),
          lastAttemptAt: (row.lastAttemptAt as Date | null) ?? null,
          lastAttemptError: (row.lastAttemptError as string | null) ?? null,
          lockedUntil,
          lockedByWorkerId: input.workerId,
        }),
      );
    }, LEAD_INTERACTIVE_TX_OPTIONS);
  }

  async markPublished(id: string, now: Date): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.leadOutboxEvent.update({
        where: { id },
        data: {
          dispatchStatus: DispatchStatus.PUBLISHED,
          publishedAt: now,
          lockedUntil: null,
          lockedByWorkerId: null,
          lastAttemptAt: now,
          lastAttemptError: null,
        },
      });
    }, LEAD_INTERACTIVE_TX_OPTIONS);
  }

  async markFailed(input: {
    id: string;
    attemptCount: number;
    error: string;
    now: Date;
  }): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.leadOutboxEvent.update({
        where: { id: input.id },
        data: {
          dispatchStatus: DispatchStatus.FAILED,
          attemptCount: input.attemptCount,
          lastAttemptAt: input.now,
          lastAttemptError: input.error.slice(0, 4000),
          lockedUntil: null,
          lockedByWorkerId: null,
        },
      });
    }, LEAD_INTERACTIVE_TX_OPTIONS);
  }

  async moveToDlq(input: {
    event: LeadOutboxEvent;
    failureReason: string;
    attempts: number;
    now: Date;
  }): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.leadOutboxDlq.create({
        data: {
          originalEventId: input.event.id,
          aggregateType: input.event.aggregateType,
          aggregateId: input.event.aggregateId,
          eventType: input.event.eventType,
          payload: input.event.payload as Prisma.InputJsonValue,
          failureReason: input.failureReason.slice(0, 4000),
          attempts: input.attempts,
          movedAt: input.now,
        },
      });
      await tx.leadOutboxEvent.update({
        where: { id: input.event.id },
        data: {
          dispatchStatus: DispatchStatus.DEAD,
          attemptCount: input.attempts,
          lastAttemptAt: input.now,
          lastAttemptError: input.failureReason.slice(0, 4000),
          lockedUntil: null,
          lockedByWorkerId: null,
        },
      });
    }, LEAD_INTERACTIVE_TX_OPTIONS);
  }

  async stats(now: Date = new Date()): Promise<OutboxMonitorStats> {
    const [
      pendingCount,
      inFlightCount,
      failedCount,
      publishedCount,
      deadCount,
      dlqCount,
      pendingOldest,
      lastPublished,
      lastAttempt,
    ] = await Promise.all([
      this.db.leadOutboxEvent.count({ where: { dispatchStatus: DispatchStatus.PENDING } }),
      this.db.leadOutboxEvent.count({ where: { dispatchStatus: DispatchStatus.IN_FLIGHT } }),
      this.db.leadOutboxEvent.count({ where: { dispatchStatus: DispatchStatus.FAILED } }),
      this.db.leadOutboxEvent.count({ where: { dispatchStatus: DispatchStatus.PUBLISHED } }),
      this.db.leadOutboxEvent.count({ where: { dispatchStatus: DispatchStatus.DEAD } }),
      this.db.leadOutboxDlq.count(),
      this.db.leadOutboxEvent.aggregate({
        where: { dispatchStatus: DispatchStatus.PENDING },
        _min: { occurredAt: true, enqueuedAt: true },
      }),
      this.db.leadOutboxEvent.aggregate({
        where: { dispatchStatus: DispatchStatus.PUBLISHED },
        _max: { publishedAt: true },
      }),
      this.db.leadOutboxEvent.aggregate({
        _max: { lastAttemptAt: true },
      }),
    ]);

    const oldest =
      pendingOldest._min.occurredAt ?? pendingOldest._min.enqueuedAt ?? null;
    const pendingLagSeconds =
      oldest == null ? null : Math.max(0, Math.floor((now.getTime() - oldest.getTime()) / 1000));

    return {
      pendingCount,
      inFlightCount,
      failedCount,
      publishedCount,
      deadCount,
      dlqCount,
      pendingLagSeconds,
      lastPublishedAt: lastPublished._max.publishedAt ?? null,
      lastDispatchAt: lastAttempt._max.lastAttemptAt ?? lastPublished._max.publishedAt ?? null,
    };
  }
}

export const prismaOutboxRepository = new PrismaOutboxRepository();
