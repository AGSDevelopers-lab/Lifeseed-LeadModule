import { prisma } from "@/lib/db";

export type CrmLeadSyncStatus = {
  target: "ZOHO" | "SALESFORCE";
  status: string;
  lastAttemptAt: string | null;
  succeededAt: string | null;
  lastError: string | null;
  attempts: number;
};

export type LeadCrmStatusResponse = {
  syncs: CrmLeadSyncStatus[];
};

const TARGETS = ["ZOHO", "SALESFORCE"] as const;

export async function getLeadCrmStatus(leadId: string): Promise<LeadCrmStatusResponse> {
  const syncs: CrmLeadSyncStatus[] = [];
  for (const target of TARGETS) {
    const row = await prisma.crmSyncQueue.findFirst({
      where: { entityType: "LEAD", entityId: leadId, syncTarget: target },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (!row) continue;
    syncs.push({
      target,
      status: row.status,
      lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
      succeededAt: row.succeededAt?.toISOString() ?? null,
      lastError: row.lastError ?? row.lastAttemptError ?? null,
      attempts: row.attempts,
    });
  }
  return { syncs };
}
