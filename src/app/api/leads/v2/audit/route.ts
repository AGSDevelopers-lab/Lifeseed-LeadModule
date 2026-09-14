import { NextResponse } from "next/server";

import { listLeadAudit } from "@/lib/leads/application/lead-audit-read";
import { requirePermission } from "@/lib/rbac";

function errorFromUnknown(err: unknown): Response {
  if (err instanceof Response) return err;
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

export async function GET(req: Request) {
  try {
    await requirePermission("audit.view");
  } catch (err) {
    return errorFromUnknown(err);
  }

  const url = new URL(req.url);
  if (url.searchParams.has("offset")) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "offset pagination is not supported" } },
      { status: 400 },
    );
  }

  const limitRaw = url.searchParams.get("limit");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  try {
    const page = await listLeadAudit({
      entityId: url.searchParams.get("entityId") ?? undefined,
      actorUserId: url.searchParams.get("actorUserId") ?? undefined,
      action: url.searchParams.get("action") ?? undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      cursor: url.searchParams.get("cursor"),
      limit: limitRaw ? Number(limitRaw) : undefined,
    });
    return NextResponse.json({ apiVersion: "v2", ...page });
  } catch (err) {
    return errorFromUnknown(err);
  }
}
