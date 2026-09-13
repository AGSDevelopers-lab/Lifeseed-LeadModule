import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { listDeliveryLogs } from "@/lib/leads/application/notification-templates";
import { requirePermission } from "@/lib/rbac";

function errorFromUnknown(err: unknown): Response {
  if (err instanceof Response) return err;
  return NextResponse.json(
    { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    await requirePermission("notification.log.view");
  } catch (err) {
    return errorFromUnknown(err);
  }
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const items = await listDeliveryLogs(prisma as never, {
    leadId: url.searchParams.get("leadId") ?? undefined,
    channel: url.searchParams.get("channel") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });
  return NextResponse.json({ items });
}
