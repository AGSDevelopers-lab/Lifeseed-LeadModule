import type { CrmSyncQueue } from "@prisma/client";

/**
 * Salesforce adapter STUB — real Connected App integration later.
 * TODO: implement Salesforce Lead sObject create/update.
 */
export async function syncToSalesforce(job: CrmSyncQueue): Promise<void> {
  await new Promise((r) => setTimeout(r, 500));
  // eslint-disable-next-line no-console
  console.info("[crm:salesforce:stub]", {
    id: job.id,
    entityType: job.entityType,
    entityId: job.entityId,
  });
}
