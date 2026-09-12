import { NextResponse } from "next/server";

import { prismaLeadRepository } from "@/lib/leads/adapters/prisma-lead-repository";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
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
  const actor = await resolveLeadActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const page = await prismaLeadRepository.list(actor, { limit: 200 });
  const rows = page.items;

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
        r.code.toString(),
        r.props.personType,
        r.props.source,
        r.props.latestScore?.tier ?? "",
        r.status,
        String(r.props.latestScore?.score ?? ""),
        csv(r.props.contact.city ?? ""),
        r.props.retention.capturedAt.toISOString(),
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
