import { NextResponse } from "next/server";

import {
  ForbiddenError,
  UnauthorizedError,
  requirePermission,
} from "@/lib/rbac";
import { runDueSchedules } from "@/lib/reports/scheduler";

/**
 * Cron endpoint for scheduled report delivery.
 * Auth: X-Cron-Secret = REPORTS_CRON_SECRET (fallback CRON_SECRET)
 *   OR session with report.schedule.
 */
export async function POST(req: Request) {
  const secret =
    process.env.REPORTS_CRON_SECRET ?? process.env.CRON_SECRET;
  const header = req.headers.get("x-cron-secret");
  const cronOk = Boolean(secret && header && header === secret);

  if (!cronOk) {
    try {
      await requirePermission("report.schedule");
    } catch (e) {
      if (e instanceof NextResponse) return e;
      if (e instanceof UnauthorizedError) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (e instanceof ForbiddenError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }
  }

  const result = await runDueSchedules();
  return NextResponse.json(result);
}
