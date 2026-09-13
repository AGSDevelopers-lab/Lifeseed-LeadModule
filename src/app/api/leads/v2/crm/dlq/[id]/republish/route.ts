import { NextResponse } from "next/server";

import { republishCrmDlqJob } from "@/lib/leads/application/crm-sync";
import { auditCrmAction, crmHttpError, requireCrmManual } from "@/lib/leads/application/crm-http";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireCrmManual();
    const { id } = await context.params;
    await republishCrmDlqJob(id);
    await auditCrmAction(session.userId, "crm.dlq.republish", id, { id });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return crmHttpError(err);
  }
}
