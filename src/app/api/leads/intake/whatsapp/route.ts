import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LeadPersonType, LeadSource } from "@prisma/client";

import { createLeadFromIntake } from "@/lib/leads/create-lead";
import {
  leadWhatsappSignatureEnforced,
  verifyMetaSignature,
} from "@/lib/security/meta-whatsapp-signature";

function hmacInvalid() {
  return NextResponse.json(
    {
      error: {
        code: "HMAC_INVALID",
        message: "Invalid Meta signature",
      },
    },
    { status: 401 },
  );
}

/**
 * WhatsApp Cloud API webhook. Signature: X-Hub-Signature-256 (HMAC-SHA256 of raw body).
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const enforced = leadWhatsappSignatureEnforced();
  const appSecret = process.env.META_APP_SECRET ?? "";

  if (enforced) {
    const ok = verifyMetaSignature(
      { headers: req.headers, body: rawBody },
      appSecret,
    );
    if (!ok) return hmacInvalid();
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = rawBody
      ? (JSON.parse(rawBody) as Record<string, unknown>)
      : {};
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
