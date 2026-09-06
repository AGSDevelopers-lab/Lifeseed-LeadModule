import type { LeadOutboxEvent } from "../domain/entities/LeadOutboxEvent";
import type { IdGenerator } from "../domain/ports/IdGenerator";
import { isLeadOutboxEnabled } from "./feature-flag";
import { createAnalyticsConsumer } from "./consumers/analytics-consumer";
import { createCrmConsumer } from "./consumers/crm-consumer";
import { createNotificationConsumer } from "./consumers/notification-consumer";
import {
  OUTBOX_MAX_ATTEMPTS,
  type DispatchSummary,
  type OutboxConsumer,
  type OutboxRepository,
} from "./outbox-types";

export type DispatchPendingContext = {
  workerId?: string;
  now?: Date;
  repo?: OutboxRepository;
  consumers?: readonly OutboxConsumer[];
  ids?: IdGenerator;
  enabled?: boolean;
};

async function resolveDefaults(ctx: DispatchPendingContext): Promise<{
  repo: OutboxRepository;
  consumers: readonly OutboxConsumer[];
}> {
  const repo =
    ctx.repo ??
    (await import("../adapters/prisma-outbox")).prismaOutboxRepository;
  if (ctx.consumers) {
    return { repo, consumers: ctx.consumers };
  }
  const { InAppNotificationPort } = await import("../adapters/in-app-notification-port");
  return {
    repo,
    consumers: [
      createCrmConsumer(),
      createNotificationConsumer(new InAppNotificationPort()),
      createAnalyticsConsumer(),
    ],
  };
}

function emptySummary(workerId: string, skipped: boolean): DispatchSummary {
  return {
    skipped,
    claimed: 0,
    published: 0,
    failed: 0,
    dead: 0,
    workerId,
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Claims unpublished outbox rows (SKIP LOCKED, earliest per aggregate) and
 * fans out to independently subscribed consumers.
 */
export async function dispatchPending(
  batchSize = 50,
  ctx: DispatchPendingContext = {},
): Promise<DispatchSummary> {
  const now = ctx.now ?? new Date();
  const workerId = ctx.workerId ?? ctx.ids?.next() ?? crypto.randomUUID();
  const enabled = ctx.enabled ?? isLeadOutboxEnabled();
  if (!enabled) {
    return emptySummary(workerId, true);
  }

  const { repo, consumers } = await resolveDefaults(ctx);
  const claimed = await repo.claimDue({
    batchSize: Math.max(1, batchSize),
    workerId,
    now,
  });

  const summary: DispatchSummary = {
    skipped: false,
    claimed: claimed.length,
    published: 0,
    failed: 0,
    dead: 0,
    workerId,
  };

  for (const event of claimed) {
    await dispatchOne(repo, consumers, event, now, summary);
  }
  return summary;
}

async function dispatchOne(
  repo: OutboxRepository,
  consumers: readonly OutboxConsumer[],
  event: LeadOutboxEvent,
  now: Date,
  summary: DispatchSummary,
): Promise<void> {
  const failures: string[] = [];
  for (const consumer of consumers) {
    try {
      await consumer.handle(event, { now });
    } catch (err) {
      failures.push(`${consumer.name}: ${errorMessage(err)}`);
    }
  }

  if (failures.length === 0) {
    await repo.markPublished(event.id, now);
    summary.published += 1;
    return;
  }

  const attemptCount = event.attemptCount + 1;
  const failureReason = failures.join("; ");
  if (attemptCount >= OUTBOX_MAX_ATTEMPTS) {
    await repo.moveToDlq({
      event,
      failureReason,
      attempts: attemptCount,
      now,
    });
    summary.dead += 1;
    return;
  }

  await repo.markFailed({
    id: event.id,
    attemptCount,
    error: failureReason,
    now,
  });
  summary.failed += 1;
}
