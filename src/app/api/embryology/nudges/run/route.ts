import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  autoCloseNoOutcome,
  runPendingNudges,
} from "@/lib/embryology/outcome-nudge";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

/**
 * Daily cron / admin trigger for outcome nudges + day-180 auto-close.
 * Auth: X-Cron-Secret header OR session with outcome.trigger_nudges.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const header = req.headers.get("x-cron-secret");
  const cronOk = Boolean(cronSecret && header && header === cronSecret);

  if (!cronOk) {
    const session = await getSession();
    if (
      !session ||
      !permissionGranted(
        permissionsForRoles(session.roles),
        "outcome.trigger_nudges",
      )
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const actorUserId = cronOk ? null : (await getSession())?.userId ?? null;

  const nudges = await runPendingNudges(actorUserId);
  const closed = await autoCloseNoOutcome(actorUserId);

  return NextResponse.json({
    ok: true,
    nudges,
    autoClose: closed,
  });
}
