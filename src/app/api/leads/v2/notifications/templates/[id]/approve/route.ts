import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  approveNotificationTemplate,
  TemplateSodViolationError,
} from "@/lib/leads/application/notification-templates";
import { requirePermission } from "@/lib/rbac";

function errorFromUnknown(err: unknown): Response {
  if (err instanceof Response) return err;
  if (err instanceof TemplateSodViolationError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: 409 });
  }
  if (err instanceof Error && err.message === "TEMPLATE_NOT_FOUND") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Template not found" } },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
    { status: 500 },
  );
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await requirePermission("notification.template.approve");
  } catch (err) {
    return errorFromUnknown(err);
  }
  const { id } = await context.params;
  try {
    const row = await approveNotificationTemplate(prisma as never, {
      id,
      actorUserId: session.userId,
    });
    return NextResponse.json({
      ok: true,
      id: row.id,
      isActive: row.isActive,
      approvedByUserId: row.approvedByUserId,
    });
  } catch (err) {
    return errorFromUnknown(err);
  }
}
