import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  LeadDonorSubType,
  LeadPersonType,
  LeadSource,
} from "@prisma/client";
import { z } from "zod";

import { createLeadFromIntake } from "@/lib/leads/create-lead";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

const bodySchema = z.object({
  personType: z.nativeEnum(LeadPersonType),
  donorSubType: z.nativeEnum(LeadDonorSubType).optional().nullable(),
  fullName: z.string().min(2),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  ageGroup: z.string().optional().nullable(),
  preferredLanguage: z.string().optional().nullable(),
  consentMarketing: z.boolean().default(false),
  consentScreening: z.boolean().default(false),
  consentDataProcessing: z.boolean().default(true),
  consentVersion: z.string().default("telecaller-v1"),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !permissionGranted(permissionsForRoles(session.roles), "lead.create")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  try {
    const lead = await createLeadFromIntake({
      ...parsed.data,
      source: LeadSource.PHONE_INBOUND,
      assignToUserId: session.userId,
      actorId: session.userId,
      consentIp:
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      consentUserAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ lead }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 },
    );
  }
}
