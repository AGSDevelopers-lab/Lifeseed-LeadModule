import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { runPendingChecks } from "@/lib/sla/engine";
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
  const cronOk = cron.ok;

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
      !permissionGranted(permissionsForRoles(session.roles), "lead.list")
    ) {
      return NextResponse.json(
        hmacCronUnauthorizedJson(cron.code, cron.message),
        { status: 401 },
      );
    }
  }

  const result = await runPendingChecks(
    cronOk ? null : (await getSession())?.userId ?? null,
  );
  return NextResponse.json(result);
}
