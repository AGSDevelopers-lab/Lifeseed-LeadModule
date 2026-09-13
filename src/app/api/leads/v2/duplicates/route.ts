import { NextResponse } from "next/server";

import { listDuplicateCases } from "@/lib/leads/application/duplicate";
import { isLeadDuplicateEnabled } from "@/lib/leads/application/feature-flag";
import { requirePermission } from "@/lib/rbac";

function errorFromUnknown(err: unknown): Response {
  if (err instanceof Response) return err;
  return NextResponse.json(
    { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
    { status: 500 },
  );
}

export async function GET(req: Request) {
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
  const url = new URL(req.url);
  const items = await listDuplicateCases({
    reviewStatus: url.searchParams.get("reviewStatus") ?? undefined,
    matchLevel: url.searchParams.get("matchLevel") ?? undefined,
  });
  return NextResponse.json({ apiVersion: "v2", items });
}
