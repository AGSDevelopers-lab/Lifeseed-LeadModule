import { NextResponse } from "next/server";

import { retryCrmSyncJob } from "@/lib/leads/application/crm-sync";
import { auditCrmAction, crmHttpError, requireCrmManual } from "@/lib/leads/application/crm-http";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireCrmManual();
    const { id } = await context.params;
    await retryCrmSyncJob(id);
    await auditCrmAction(session.userId, "crm.queue.retry", id, { id });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return crmHttpError(err);
  }
}
