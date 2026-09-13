import { CrmSyncStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { listCrmSyncQueue } from "@/lib/leads/application/crm-sync";
import { crmHttpError, requireCrmManual } from "@/lib/leads/application/crm-http";

export async function GET(request: Request) {
  try {
    await requireCrmManual();
    const url = new URL(request.url);
    const statusRaw = url.searchParams.get("status");
    const status =
      statusRaw && Object.values(CrmSyncStatus).includes(statusRaw as CrmSyncStatus)
        ? (statusRaw as CrmSyncStatus)
        : undefined;
    const items = await listCrmSyncQueue({ status, take: 100 });
    return NextResponse.json({ items });
  } catch (err) {
    return crmHttpError(err);
  }
}
