import { NextResponse } from "next/server";

import { createPrismaAssignmentDirectory } from "@/lib/leads/adapters/prisma-assignment-directory";
import { loadAssignmentRules } from "@/lib/leads/adapters/prisma-assignment-directory";
import { requirePermission } from "@/lib/rbac";

function errorFromUnknown(err: unknown): Response {
  if (err instanceof Response) return err;
  return NextResponse.json(
    { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
    { status: 500 },
  );
}

export async function GET() {
  try {
    await requirePermission("lead.list");
  } catch (err) {
    return errorFromUnknown(err);
  }
  const rules = await loadAssignmentRules();
  const directory = await createPrismaAssignmentDirectory();
  const items = await directory.listAvailableTelecallers();
  const bySite = new Map<
    string,
    { siteId: string | null; telecallers: number; openLeads: number; atCapacity: number }
  >();
  for (const row of items) {
    const key = row.siteId ?? "unscoped";
    const cur = bySite.get(key) ?? {
      siteId: row.siteId,
      telecallers: 0,
      openLeads: 0,
      atCapacity: 0,
    };
    cur.telecallers += 1;
    cur.openLeads += row.openLeadCount;
    if (row.openLeadCount >= rules.maxQueuePerTelecaller) cur.atCapacity += 1;
    bySite.set(key, cur);
  }
  return NextResponse.json({
    maxQueuePerTelecaller: rules.maxQueuePerTelecaller,
    items,
    bySite: [...bySite.values()],
  });
}
