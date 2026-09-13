import { NextResponse } from "next/server";

import { crmStatusByExternalId } from "@/lib/leads/application/crm-sync";
import { crmHttpError, requireCrmManual } from "@/lib/leads/application/crm-http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ externalId: string }> },
) {
  try {
    await requireCrmManual();
    const { externalId } = await context.params;
    const row = await crmStatusByExternalId(externalId);
    if (!row) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Unknown external id" } },
        { status: 404 },
      );
    }
    return NextResponse.json({
      externalId: row.externalId,
      entityId: row.entityId,
      entityType: row.entityType,
      status: row.status,
      syncTarget: row.syncTarget,
      outboxEventId: row.outboxEventId,
      jobId: row.id,
    });
  } catch (err) {
    return crmHttpError(err);
  }
}
