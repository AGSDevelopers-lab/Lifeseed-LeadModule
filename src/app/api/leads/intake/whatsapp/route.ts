import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LeadPersonType, LeadSource } from "@prisma/client";

import { createLeadFromIntake } from "@/lib/leads/create-lead";

/**
 * WhatsApp webhook stub (Gupshup/Twilio).
 * Accepts signature prefix stub_ok_* in x-gupshup-signature.
 */
export async function POST(req: NextRequest) {
  const sig = req.headers.get("x-gupshup-signature") ?? "";
  const expected = process.env.WHATSAPP_WEBHOOK_SECRET ?? "stub_ok_dev";
  if (!sig.startsWith("stub_ok_") && sig !== expected) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Ack immediately — process body best-effort
  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const text = String(payload.text ?? payload.message ?? "");
  const phone = String(payload.phone ?? payload.from ?? "").replace(/\D/g, "");
  const name = String(payload.name ?? payload.profileName ?? "WhatsApp Lead");

  if (phone.length >= 10) {
    void createLeadFromIntake({
      personType: LeadPersonType.DONOR,
      source: LeadSource.WHATSAPP_BOT,
      fullName: name,
      phone: phone.slice(-10),
      consentMarketing: true,
      consentScreening: false,
      consentDataProcessing: true,
      consentVersion: "wa-v1",
      sourceMetadata: { raw: payload, text },
      preferredLanguage: "English",
    }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true });
}
