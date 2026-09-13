import {
  CrmEntityType,
  CrmOperation,
  CrmSyncStatus,
  CrmSyncTarget,
  type Prisma,
} from "@prisma/client";

import { CrmOperation as DomainCrmOperation } from "../../domain/enums";
import type { LeadEventType } from "../../domain/enums";
import type { LeadOutboxEvent } from "../../domain/entities/LeadOutboxEvent";
import type { OutboxConsumer } from "../outbox-types";
import { crmSyncEnqueueTargets } from "../feature-flag";

export function crmOperationFor(eventType: LeadEventType): DomainCrmOperation {
  switch (eventType) {
    case "LeadCreated":
    case "LeadAssigned":
    case "LeadMerged":
    case "LeadReactivated":
    case "LeadScoreChanged":
      return DomainCrmOperation.UPSERT_LEAD;
    case "LeadContacted":
    case "LeadQualified":
    case "CounsellingAttended":
    case "CounsellingNoShow":
    case "LeadArchived":
    case "LeadDncAdded":
      return DomainCrmOperation.UPDATE_STATUS;
    case "LeadFollowUpCreated":
    case "LeadFollowUpCompleted":
    case "CounsellingBooked":
      return DomainCrmOperation.LOG_ACTIVITY;
    case "LeadLost":
      return DomainCrmOperation.CLOSE_LEAD;
    case "LeadConverted":
      return DomainCrmOperation.CONVERT;
  }
}

export type CrmEnqueueFn = (event: LeadOutboxEvent) => Promise<void>;

export async function enqueueCrmSyncFromOutbox(
  event: LeadOutboxEvent,
  db?: {
    crmSyncQueue: {
      findFirst: (args: {
        where: { outboxEventId: string; syncTarget?: CrmSyncTarget };
      }) => Promise<{ id: string } | null>;
      create: (args: { data: Prisma.CrmSyncQueueCreateInput }) => Promise<unknown>;
    };
  },
): Promise<void> {
  const client = db ?? (await import("@/lib/db")).prisma;
  const targets = crmSyncEnqueueTargets();

  for (const target of targets) {
    const existing = await client.crmSyncQueue.findFirst({
      where: { outboxEventId: event.id, syncTarget: target },
    });
    if (existing) continue;

    await client.crmSyncQueue.create({
      data: {
        entityType: CrmEntityType.LEAD,
        entityId: event.aggregateId,
        syncTarget: target,
        payload: {
          eventType: event.eventType,
          eventVersion: event.eventVersion,
          ...event.payload,
        } as Prisma.InputJsonValue,
        status: CrmSyncStatus.PENDING,
        outboxEventId: event.id,
        operation: crmOperationFor(event.eventType) as CrmOperation,
        payloadVersion: event.eventVersion,
      },
    });
  }
}

export function createCrmConsumer(enqueue: CrmEnqueueFn = enqueueCrmSyncFromOutbox): OutboxConsumer {
  return {
    name: "crm",
    async handle(event: LeadOutboxEvent): Promise<void> {
      await enqueue(event);
    },
  };
}
