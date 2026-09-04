import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { runPendingSync } from "@/lib/crm/sync-queue";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import {
  authorizeLeadCronRequest,
  hmacCronUnauthorizedJson,
} from "@/lib/security/hmac-cron";

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

  const result = await runPendingSync();
  return NextResponse.json(result);
}
