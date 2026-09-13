import { NextResponse } from "next/server";

import { getDuplicateCase } from "@/lib/leads/application/duplicate";
import { isLeadDuplicateEnabled } from "@/lib/leads/application/feature-flag";
import { requirePermission } from "@/lib/rbac";

function errorFromUnknown(err: unknown): Response {
  if (err instanceof Response) return err;
  return NextResponse.json(
    { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
    { status: 500 },
  );
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isLeadDuplicateEnabled()) {
    return NextResponse.json(
      { error: { code: "FEATURE_OFF", message: "Lead duplicate detection is disabled" } },
      { status: 404 },
    );
  }
  try {
    await requirePermission("duplicate.review");
  } catch (err) {
    return errorFromUnknown(err);
  }
  const { id } = await ctx.params;
  const detail = await getDuplicateCase(id);
  if (!detail) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Duplicate case not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ apiVersion: "v2", ...detail });
}
