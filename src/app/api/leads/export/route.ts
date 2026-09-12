import { NextResponse } from "next/server";

import { getConfigStoreAdapter } from "@/lib/leads/adapters/config-store-adapter";
import { prismaLeadRepository } from "@/lib/leads/adapters/prisma-lead-repository";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { resolveConfigPayload } from "@/lib/leads/application/config-store";
import { DEFAULT_EXPORT_ROW_CAP } from "@/lib/leads/config/defaults";
import { CONFIG_KEYS } from "@/lib/leads/config/keys";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

/** CONFLICT-26 — CSV cap via LeadConfig EXPORT_ROW_CAP_V1, actor-scoped list. */
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

  const cap = await resolveConfigPayload(
    getConfigStoreAdapter(prisma),
    CONFIG_KEYS.EXPORT_ROW_CAP_V1,
    DEFAULT_EXPORT_ROW_CAP,
  );
  const maxRows = Math.min(Math.max(cap.maxRows ?? 5000, 1), 5000);

  const page = await prismaLeadRepository.list(actor, {
    limit: maxRows,
    purpose: "export",
  });
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
