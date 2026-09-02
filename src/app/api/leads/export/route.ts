import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!permissionGranted(permissionsForRoles(session.roles), "lead.export")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const headers = [
    "leadCode",
    "personType",
    "source",
    "tier",
    "status",
    "score",
    "city",
    "capturedAt",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.leadCode,
        r.personType,
        r.source,
        r.tier,
        r.status,
        String(r.score),
        csv(r.city ?? ""),
        r.capturedAt.toISOString(),
      ].join(","),
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="leads-export.csv"',
    },
  });
}

function csv(v: string) {
  if (v.includes(",") || v.includes('"')) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
