import { NextResponse } from "next/server";
import { z } from "zod";

import { createCampaign, listCampaigns } from "@/lib/leads/application/campaign";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { LeadDomainError } from "@/lib/leads/domain/errors";
import { requirePermission } from "@/lib/rbac";

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  source: z.string().min(1),
  medium: z.string().nullable().optional(),
  channel: z.string().nullable().optional(),
  startAt: z.string().min(1),
  endAt: z.string().nullable().optional(),
  budgetInr: z.union([z.string(), z.number()]).nullable().optional(),
  actualSpendInr: z.union([z.string(), z.number()]).nullable().optional(),
  creativeRefs: z.unknown().optional(),
  landingPageUrls: z.unknown().optional(),
  referralPartnerId: z.string().nullable().optional(),
  utmDefaults: z.unknown().optional(),
  notes: z.string().nullable().optional(),
});

export function campaignErrorResponse(err: unknown): Response {
  if (err instanceof Response) return err;
  if (err instanceof LeadDomainError) {
    const status =
      err.code === "LEAD_PERMISSION_DENIED"
        ? 403
        : err.code === "CAMPAIGN_ILLEGAL_TRANSITION"
          ? 409
          : 400;
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.context } },
      { status },
    );
  }
  return NextResponse.json(
    { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
    { status: 500 },
  );
}

export async function GET() {
  try {
    await requirePermission("campaign.view");
    const actor = await resolveLeadActor();
    if (!actor) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
    }
    const items = await listCampaigns(actor);
    return NextResponse.json({ apiVersion: "v2", items });
  } catch (err) {
    return campaignErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission("campaign.create");
    const actor = await resolveLeadActor();
    if (!actor) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
    }
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid JSON" } }, { status: 400 });
    }
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid body" } }, { status: 400 });
    }
    const body = parsed.data;
    const row = await createCampaign(actor, {
      name: body.name,
      code: body.code,
      source: body.source,
      medium: body.medium,
      channel: body.channel,
      startAt: new Date(body.startAt),
      endAt: body.endAt ? new Date(body.endAt) : null,
      budgetInr: body.budgetInr,
      actualSpendInr: body.actualSpendInr,
      ownerUserId: session.userId,
      creativeRefs: body.creativeRefs as never,
      landingPageUrls: body.landingPageUrls as never,
      referralPartnerId: body.referralPartnerId,
      utmDefaults: body.utmDefaults as never,
      notes: body.notes,
    });
    return NextResponse.json({ apiVersion: "v2", item: row }, { status: 201 });
  } catch (err) {
    return campaignErrorResponse(err);
  }
}
