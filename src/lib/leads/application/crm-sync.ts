import { CrmSyncStatus, CrmSyncTarget } from "@prisma/client";

import { prisma } from "@/lib/db";
import { crmAdapterFor } from "../adapters/crm";
import {
  isCrmProviderSyncEnabled,
  isCrmSyncEnabled,
} from "./feature-flag";

const MAX_ATTEMPTS = 5;

export type CrmSyncRunSummary = {
  idle: boolean;
  processed: number;
  synced: number;
  failed: number;
  skippedProvider: number;
};

/**
 * Canonical CrmSyncQueue worker. When CRM_SYNC_ENABLED is off, the worker idles.
 * Per-provider flags leave jobs PENDING (idle for that provider).
 */
export async function runCrmSyncQueue(now = new Date()): Promise<CrmSyncRunSummary> {
  if (!isCrmSyncEnabled()) {
    return { idle: true, processed: 0, synced: 0, failed: 0, skippedProvider: 0 };
  }

  const pending = await prisma.crmSyncQueue.findMany({
    where: {
      status: { in: [CrmSyncStatus.PENDING, CrmSyncStatus.RETRYING] },
      scheduledFor: { lte: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
    take: 50,
    orderBy: { scheduledFor: "asc" },
  });

  const summary: CrmSyncRunSummary = {
    idle: false,
    processed: pending.length,
    synced: 0,
    failed: 0,
    skippedProvider: 0,
  };

  for (const job of pending) {
    const target = job.syncTarget as "ZOHO" | "SALESFORCE";
    if (!isCrmProviderSyncEnabled(target)) {
      summary.skippedProvider += 1;
      continue;
    }
    try {
      await crmAdapterFor(target).sync(job.id);
      summary.synced += 1;
    } catch (err) {
      const attempts = job.attempts + 1;
      const backoffMin = 2 ** attempts;
      const scheduledFor = new Date(now);
      scheduledFor.setUTCMinutes(scheduledFor.getUTCMinutes() + backoffMin);
      const message = err instanceof Error ? err.message : "sync failed";
      await prisma.crmSyncQueue.update({
        where: { id: job.id },
        data: {
          status: attempts >= MAX_ATTEMPTS ? CrmSyncStatus.FAILED : CrmSyncStatus.RETRYING,
          attempts,
          lastAttemptAt: now,
          lastError: message,
          lastAttemptError: message,
          scheduledFor,
        },
      });
      summary.failed += 1;
    }
  }

  return summary;
}

export async function retryCrmSyncJob(id: string): Promise<void> {
  await prisma.crmSyncQueue.update({
    where: { id },
    data: {
      status: CrmSyncStatus.PENDING,
      scheduledFor: new Date(),
      lastError: null,
    },
  });
}

export async function republishCrmDlqJob(id: string): Promise<void> {
  await prisma.crmSyncQueue.update({
    where: { id },
    data: {
      status: CrmSyncStatus.PENDING,
      attempts: 0,
      scheduledFor: new Date(),
      lastError: null,
      lastAttemptError: null,
    },
  });
}

export async function discardCrmDlqJob(id: string): Promise<void> {
  await prisma.crmSyncQueue.update({
    where: { id },
    data: { status: CrmSyncStatus.SKIPPED },
  });
}

export async function listCrmSyncQueue(args: {
  status?: CrmSyncStatus;
  take?: number;
}) {
  return prisma.crmSyncQueue.findMany({
    where: args.status ? { status: args.status } : undefined,
    orderBy: { createdAt: "desc" },
    take: args.take ?? 50,
  });
}

export async function crmStatusByExternalId(externalId: string) {
  return prisma.crmSyncQueue.findFirst({
    where: { externalId },
    orderBy: { createdAt: "desc" },
  });
}

export function isCrmDlqStatus(status: CrmSyncStatus): boolean {
  return status === CrmSyncStatus.FAILED;
}

export { CrmSyncTarget, CrmSyncStatus };
