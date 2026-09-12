import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { tickCounsellingNoShows } from "@/lib/leads/application/auto-transitions";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import {
  authorizeLeadCronMachine,
  hmacCronUnauthorizedJson,
  leadHmacCronEnforced,
} from "@/lib/security/hmac-cron";

function staticSecretFrom(req: NextRequest): string | null {
  return (
    req.headers.get("x-cron-secret") ??
    (req.headers.get("authorization")?.startsWith("Bearer ")
      ? req.headers.get("authorization")!.slice("Bearer ".length).trim()
      : null)
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const cron = authorizeLeadCronMachine({
    hmacHeader:
      req.headers.get("x-lifeseed-cron-signature") ??
      req.headers.get("X-LifeSeed-Cron-Signature"),
    staticHeader: staticSecretFrom(req),
    body,
    hmacSecret: process.env.LEADS_CRON_HMAC_SECRET,
    staticSecret: process.env.LEADS_CRON_SECRET ?? process.env.CRON_SECRET,
    mode: leadHmacCronEnforced(),
  });

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
      !permissionGranted(permissionsForRoles(session.roles), "crm.sync.manual")
    ) {
      return NextResponse.json(
        hmacCronUnauthorizedJson(cron.code, cron.message),
        { status: 401 },
      );
    }
  }

  const summary = await tickCounsellingNoShows();
  return NextResponse.json({ ok: true, ...summary });
}
