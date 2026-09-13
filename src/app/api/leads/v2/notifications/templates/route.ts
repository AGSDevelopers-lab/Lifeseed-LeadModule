import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import {
  listNotificationTemplates,
  proposeNotificationTemplate,
  TemplateSodViolationError,
} from "@/lib/leads/application/notification-templates";
import { LeadInvariantViolationError } from "@/lib/leads/domain/errors";
import { requirePermission } from "@/lib/rbac";

const postSchema = z.object({
  key: z.string().min(1),
  channel: z.enum(["EMAIL", "SMS", "WHATSAPP", "IN_APP"]),
  provider: z.enum(["RESEND", "SMS_MAGIC", "META_WHATSAPP", "IN_APP"]),
  subject: z.string().nullable().optional(),
  body: z.string().min(1),
  variables: z.unknown().default(["body"]),
  language: z.enum(["ENGLISH", "HINDI", "BENGALI", "TELUGU", "OTHER"]).default("ENGLISH"),
});

function errorFromUnknown(err: unknown): Response {
  if (err instanceof Response) return err;
  if (err instanceof TemplateSodViolationError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: 409 });
  }
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

export async function GET() {
  try {
    await requirePermission("notification.template.view");
  } catch (err) {
    return errorFromUnknown(err);
  }
  const items = await listNotificationTemplates(prisma as never);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requirePermission("notification.template.propose");
  } catch (err) {
    return errorFromUnknown(err);
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON" } },
      { status: 400 },
    );
  }
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid body" } },
      { status: 400 },
    );
  }
  try {
    const row = await proposeNotificationTemplate(prisma as never, {
      ...parsed.data,
      actorUserId: session.userId,
    });
    return NextResponse.json({ ok: true, id: row.id, version: row.version });
  } catch (err) {
    return errorFromUnknown(err);
  }
}
