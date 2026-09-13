import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { applyDeliveryWebhookUpdate } from "@/lib/leads/application/notification-templates";
import {
  leadWhatsappSignatureEnforced,
  verifyMetaSignature,
} from "@/lib/security/meta-whatsapp-signature";

function extractStatuses(payload: unknown): Array<{ id: string; status: string }> {
  if (!payload || typeof payload !== "object") return [];
  const entry = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entry)) {
    const id = String((payload as { id?: unknown }).id ?? "");
    const status = String((payload as { status?: unknown }).status ?? "");
    return id && status ? [{ id, status }] : [];
  }
  const out: Array<{ id: string; status: string }> = [];
  for (const e of entry) {
    if (!e || typeof e !== "object") continue;
    const changes = (e as { changes?: unknown }).changes;
    if (!Array.isArray(changes)) continue;
    for (const c of changes) {
      if (!c || typeof c !== "object") continue;
      const value = (c as { value?: unknown }).value;
      if (!value || typeof value !== "object") continue;
      const statuses = (value as { statuses?: unknown }).statuses;
      if (!Array.isArray(statuses)) continue;
      for (const s of statuses) {
        if (!s || typeof s !== "object") continue;
        const id = String((s as { id?: unknown }).id ?? "");
        const status = String((s as { status?: unknown }).status ?? "");
        if (id && status) out.push({ id, status });
      }
    }
  }
  return out;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const enforced = leadWhatsappSignatureEnforced();
  const appSecret = process.env.META_APP_SECRET ?? "";
  if (enforced) {
    const ok = verifyMetaSignature(
      { headers: { get: (n: string) => req.headers.get(n) }, body: rawBody },
      appSecret,
    );
    if (!ok) {
      return NextResponse.json(
        { error: { code: "HMAC_INVALID", message: "Invalid Meta signature" } },
        { status: 401 },
      );
    }
  }
  let payload: unknown = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ ok: true });
  }
  for (const row of extractStatuses(payload)) {
    await applyDeliveryWebhookUpdate(prisma as never, {
      providerMessageId: row.id,
      status: row.status,
    });
  }
  return NextResponse.json({ ok: true });
}
