import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { applyDeliveryWebhookUpdate } from "@/lib/leads/application/notification-templates";
import { verifyResendSvixSignature } from "@/lib/leads/adapters/notification/resend-svix";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET ?? "";
  const ok = verifyResendSvixSignature({
    secret,
    rawBody,
    svixId: req.headers.get("svix-id"),
    svixTimestamp: req.headers.get("svix-timestamp"),
    svixSignature: req.headers.get("svix-signature"),
  });
  if (!ok) {
    return NextResponse.json(
      { error: { code: "HMAC_INVALID", message: "Invalid Resend signature" } },
      { status: 401 },
    );
  }
  let payload: Record<string, unknown> = {};
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ ok: true });
  }
  const type = String(payload.type ?? "");
  const data =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : {};
  const providerMessageId = String(data.email_id ?? data.id ?? "");
  const status = type || String(data.status ?? "");
  if (providerMessageId && status) {
    await applyDeliveryWebhookUpdate(prisma as never, {
      providerMessageId,
      status,
      failureReason: type.includes("bounce") || type.includes("failed") ? type : null,
    });
  }
  return NextResponse.json({ ok: true });
}
