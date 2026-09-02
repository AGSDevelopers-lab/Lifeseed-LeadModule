import {
  CrmEntityType,
  CrmSyncStatus,
  CrmSyncTarget,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import { syncToSalesforce } from "@/lib/crm/adapters/salesforce-adapter";
import { syncToZoho } from "@/lib/crm/adapters/zoho-adapter";

function crmEnabled(): boolean {
  return process.env.CRM_SYNC_ENABLED === "true";
}

export async function enqueue(
  entityType: CrmEntityType,
  entityId: string,
  target: CrmSyncTarget = CrmSyncTarget.ZOHO,
  payload: Record<string, unknown> = {},
): Promise<string | null> {
  if (!crmEnabled()) {
    const row = await prisma.crmSyncQueue.create({
      data: {
        entityType,
        entityId,
        syncTarget: target,
        payload: payload as Prisma.InputJsonValue,
        status: CrmSyncStatus.SKIPPED,
      },
    });
    return row.id;
  }

  const row = await prisma.crmSyncQueue.create({
    data: {
      entityType,
      entityId,
      syncTarget: target,
      payload: payload as Prisma.InputJsonValue,
      status: CrmSyncStatus.PENDING,
    },
  });
  return row.id;
}

export async function runPendingSync(): Promise<{
  synced: number;
  failed: number;
  skipped: number;
}> {
  const pending = await prisma.crmSyncQueue.findMany({
    where: {
      status: { in: [CrmSyncStatus.PENDING, CrmSyncStatus.RETRYING] },
      scheduledFor: { lte: new Date() },
      attempts: { lt: 5 },
    },
    take: 50,
    orderBy: { scheduledFor: "asc" },
  });

  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of pending) {
    if (!crmEnabled()) {
      await prisma.crmSyncQueue.update({
        where: { id: job.id },
        data: { status: CrmSyncStatus.SKIPPED },
      });
      skipped += 1;
      continue;
    }

    try {
      if (job.syncTarget === CrmSyncTarget.ZOHO) {
        await syncToZoho(job);
      } else {
        await syncToSalesforce(job);
      }
      await prisma.crmSyncQueue.update({
        where: { id: job.id },
        data: {
          status: CrmSyncStatus.SYNCED,
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          succeededAt: new Date(),
          lastError: null,
        },
      });
      synced += 1;
    } catch (e) {
      const attempts = job.attempts + 1;
      const backoffMin = Math.pow(2, attempts);
      const scheduledFor = new Date();
      scheduledFor.setUTCMinutes(scheduledFor.getUTCMinutes() + backoffMin);
      await prisma.crmSyncQueue.update({
        where: { id: job.id },
        data: {
          status:
            attempts >= 5 ? CrmSyncStatus.FAILED : CrmSyncStatus.RETRYING,
          attempts,
          lastAttemptAt: new Date(),
          lastError: e instanceof Error ? e.message : "sync failed",
          scheduledFor,
        },
      });
      failed += 1;
    }
  }

  return { synced, failed, skipped };
}
