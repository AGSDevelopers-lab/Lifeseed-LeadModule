import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { applyDeliveryWebhookUpdate } from "@/lib/leads/application/notification-templates";
import { verifyHmacSha256Hex } from "@/lib/leads/adapters/notification/hmac-raw-body";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = process.env.SMS_MAGIC_WEBHOOK_SECRET ?? "";
  const header =
    req.headers.get("x-sms-magic-signature") ?? req.headers.get("x-signature");
  if (!verifyHmacSha256Hex(secret, rawBody, header)) {
    return NextResponse.json(
      { error: { code: "HMAC_INVALID", message: "Invalid SMS-Magic signature" } },
      { status: 401 },
    );
  }
  let payload: Record<string, unknown> = {};
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ ok: true });
  }
  const providerMessageId = String(
    payload.messageId ?? payload.providerMessageId ?? payload.id ?? "",
  );
  const status = String(payload.status ?? payload.deliveryStatus ?? "");
  if (providerMessageId && status) {
    await applyDeliveryWebhookUpdate(prisma as never, { providerMessageId, status });
  }
  return NextResponse.json({ ok: true });
}
