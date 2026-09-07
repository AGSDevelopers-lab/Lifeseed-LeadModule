import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getConfigStoreAdapter } from "@/lib/leads/adapters/config-store-adapter";
import { assertConfigKey } from "@/lib/leads/application/config-store";
import { LeadInvariantViolationError } from "@/lib/leads/domain/errors";
import { requirePermission } from "@/lib/rbac";

function errorFromUnknown(err: unknown): Response {
  if (err instanceof Response) return err;
  if (err instanceof LeadInvariantViolationError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
    { status: 500 },
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> },
) {
  try {
    await requirePermission("lead.config.view");
  } catch (err) {
    return errorFromUnknown(err);
  }
  const { key: raw } = await context.params;
  try {
    const key = assertConfigKey(raw);
    const history = await getConfigStoreAdapter(prisma).history(key);
    return NextResponse.json({
      key,
      items: history.map((r) => ({
        id: r.id,
        version: r.version,
        payload: r.payload,
        isActive: r.isActive,
        createdByUserId: r.createdByUserId,
        createdAt: r.createdAt.toISOString(),
        approvedByUserId: r.approvedByUserId,
        approvedAt: r.approvedAt?.toISOString() ?? null,
        effectiveFrom: r.effectiveFrom?.toISOString() ?? null,
        effectiveUntil: r.effectiveUntil?.toISOString() ?? null,
        notes: r.notes,
      })),
    });
  } catch (err) {
    return errorFromUnknown(err);
  }
}
