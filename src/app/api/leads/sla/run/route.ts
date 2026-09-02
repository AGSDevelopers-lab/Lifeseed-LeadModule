import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { runPendingChecks } from "@/lib/sla/engine";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export async function POST(req: NextRequest) {
  const secret = process.env.LEADS_CRON_SECRET ?? process.env.CRON_SECRET;
  const header = req.headers.get("x-cron-secret");
  const cronOk = Boolean(secret && header && header === secret);

  if (!cronOk) {
    const session = await getSession();
    if (
      !session ||
      !permissionGranted(permissionsForRoles(session.roles), "lead.list")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await runPendingChecks(
    cronOk ? null : (await getSession())?.userId ?? null,
  );
  return NextResponse.json(result);
}
