import type { CrmSyncQueue } from "@prisma/client";

/**
 * Zoho CRM adapter STUB — real OAuth + upsert in a later sprint.
 * TODO: implement Zoho CRM Leads module API (v2 /crm/v2/Leads).
 */
export async function syncToZoho(job: CrmSyncQueue): Promise<void> {
  await new Promise((r) => setTimeout(r, 500));
  // eslint-disable-next-line no-console
  console.info("[crm:zoho:stub]", {
    id: job.id,
    entityType: job.entityType,
    entityId: job.entityId,
  });
}
