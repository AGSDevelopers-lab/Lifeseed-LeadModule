import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  LeadDonorSubType,
  LeadPersonType,
  LeadSource,
} from "@prisma/client";
import { z } from "zod";

import { createLeadFromIntake } from "@/lib/leads/create-lead";
import { checkLeadRateLimit } from "@/lib/leads/rate-limit";

const bodySchema = z.object({
  personType: z.nativeEnum(LeadPersonType),
  donorSubType: z.nativeEnum(LeadDonorSubType).optional().nullable(),
  fullName: z.string().min(2),
  phone: z.string().min(10).max(15),
  phoneCountryCode: z.string().optional(),
  email: z.string().email().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  ageGroup: z.string().optional().nullable(),
  preferredLanguage: z.string().optional().nullable(),
  consentMarketing: z.boolean(),
  consentScreening: z.boolean(),
  consentDataProcessing: z.boolean(),
  consentVersion: z.string().min(1),
  sourceMetadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rl = checkLeadRateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec) },
      },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const lead = await createLeadFromIntake({
      ...parsed.data,
      source: LeadSource.WEB_FORM,
      consentIp: ip,
      consentUserAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json({
      leadCode: lead.leadCode,
      tier: lead.tier,
      message: "Thank you. Our team will contact you shortly.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
