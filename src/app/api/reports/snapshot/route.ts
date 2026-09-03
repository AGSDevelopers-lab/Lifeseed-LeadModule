import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ForbiddenError,
  UnauthorizedError,
  requirePermission,
} from "@/lib/rbac";
import { snapshotReport } from "@/lib/reports/runner";

const bodySchema = z.object({
  reportId: z.string().min(1),
  filters: z.record(z.string(), z.unknown()).default({}),
  name: z.string().min(1),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requirePermission("report.snapshot");
    const json: unknown = await req.json();
    const body = bodySchema.parse(json);
    await requirePermission(`report.run.${body.reportId}`);
    const result = await snapshotReport(
      body.reportId,
      body.filters,
      session,
      body.name,
      body.notes,
    );
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof NextResponse) return e;
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Snapshot failed" }, { status: 500 });
  }
}
