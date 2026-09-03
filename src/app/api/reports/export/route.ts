import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ForbiddenError,
  UnauthorizedError,
  requirePermission,
} from "@/lib/rbac";
import { exportReport } from "@/lib/reports/runner";

const bodySchema = z.object({
  reportId: z.string().min(1),
  filters: z.record(z.string(), z.unknown()).default({}),
  format: z.enum(["CSV", "XLSX", "PDF", "JSON"]),
});

export async function POST(req: Request) {
  try {
    const session = await requirePermission("report.list");
    const json: unknown = await req.json();
    const body = bodySchema.parse(json);

    const formatPerm =
      body.format === "CSV"
        ? "report.export.csv"
        : body.format === "XLSX"
          ? "report.export.xlsx"
          : body.format === "PDF"
            ? "report.export.pdf"
            : "report.export.csv";
    await requirePermission(formatPerm);
    await requirePermission(`report.run.${body.reportId}`);

    const result = await exportReport(
      body.reportId,
      body.filters,
      body.format,
      session,
    );

    if (result.signedUrl) {
      return NextResponse.json({
        runId: result.runId,
        signedUrl: result.signedUrl,
        path: result.path,
        dryRun: result.dryRun,
      });
    }

    // Dry-run / no storage: return file inline
    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${body.reportId}.${body.format.toLowerCase()}"`,
        "X-Report-Run-Id": result.runId,
        "X-Reports-Dry-Run": String(result.dryRun),
      },
    });
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
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
