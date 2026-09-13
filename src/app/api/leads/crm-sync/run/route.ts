import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { dispatchPending } from "@/lib/leads/application/outbox-dispatcher";
import { runCrmSyncQueue } from "@/lib/leads/application/crm-sync";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import {
  authorizeLeadCronRequest,
  hmacCronUnauthorizedJson,
} from "@/lib/security/hmac-cron";

/**
 * Canonical CRM run: outbox dispatcher (CRM consumer → CrmSyncQueue) then CrmPort worker.
 * Replaces System A's runPendingSync().
 */
export async function POST(req: NextRequest) {
  const cron = await authorizeLeadCronRequest(req);

  if (!cron.ok) {
    if (!cron.allowSessionFallback) {
      return NextResponse.json(
        hmacCronUnauthorizedJson(cron.code, cron.message),
        { status: 401 },
      );
    }
    const session = await getSession();
    if (
      !session ||
      !permissionGranted(
        permissionsForRoles(session.roles),
        "crm.sync.manual",
      )
    ) {
      return NextResponse.json(
        hmacCronUnauthorizedJson(cron.code, cron.message),
        { status: 401 },
      );
    }
  }

  const dispatch = await dispatchPending(50, {});
  const sync = await runCrmSyncQueue();
  return NextResponse.json({ dispatch, sync });
}
