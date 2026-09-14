import { NextResponse } from "next/server";

import { isLead360Enabled } from "@/lib/leads/application/feature-flag";
import { authorizeLeadDetailRead } from "@/lib/leads/application/lead-detail-read-auth";
import { listLeadTimeline } from "@/lib/leads/application/lead-timeline";

function flagOff() {
  return NextResponse.json(
    { error: { code: "FEATURE_OFF", message: "Lead 360 is disabled" } },
    { status: 404 },
  );
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isLead360Enabled()) return flagOff();
  const { id } = await context.params;
  const auth = await authorizeLeadDetailRead(id);
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  try {
    const page = await listLeadTimeline(id, { cursor, limit: Number.isFinite(limit) ? limit : undefined });
    return NextResponse.json(page);
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_CURSOR") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid cursor" } },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
      { status: 500 },
    );
  }
}
