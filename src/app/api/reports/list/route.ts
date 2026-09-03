import { NextResponse } from "next/server";

import {
  ForbiddenError,
  UnauthorizedError,
  requirePermission,
} from "@/lib/rbac";
import { listReports } from "@/lib/reports/registry";

export async function GET() {
  try {
    const session = await requirePermission("report.list");
    const reports = listReports(session).map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      description: r.description,
      exportFormats: r.exportFormats,
      filters: r.filters,
      columns: r.columns.map((c) => ({
        key: c.key,
        label: c.label,
        description: c.description,
        formatter: c.formatter,
        sortable: c.sortable,
        numeric: c.numeric,
        higherIsBetter: c.higherIsBetter,
      })),
    }));
    return NextResponse.json({ reports });
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
