import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { LeadDomainError } from "@/lib/leads/domain/errors";
import { requirePermission } from "@/lib/rbac";

export async function requireCrmManual(): Promise<{ userId: string; roles: string[] }> {
  return requirePermission("crm.sync.manual");
}

export function crmHttpError(err: unknown): Response {
  if (err instanceof Response) return err;
  if (err instanceof LeadDomainError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
    { status: 500 },
  );
}

export async function auditCrmAction(
  actorUserId: string,
  action: string,
  entityId: string,
  after: Record<string, unknown>,
): Promise<void> {
  await audit.log({
    actorUserId,
    action,
    entityType: "CrmSyncQueue",
    entityId,
    afterJson: after,
  });
}
