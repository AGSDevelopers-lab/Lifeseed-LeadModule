import { NextResponse } from "next/server";
import { z } from "zod";

import { getCampaign, patchCampaign } from "@/lib/leads/application/campaign";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { requirePermission } from "@/lib/rbac";

import { campaignErrorResponse } from "../route";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  medium: z.string().nullable().optional(),
  channel: z.string().nullable().optional(),
  startAt: z.string().optional(),
  endAt: z.string().nullable().optional(),
  budgetInr: z.union([z.string(), z.number()]).nullable().optional(),
  actualSpendInr: z.union([z.string(), z.number()]).nullable().optional(),
  creativeRefs: z.unknown().optional(),
  landingPageUrls: z.unknown().optional(),
  referralPartnerId: z.string().nullable().optional(),
  utmDefaults: z.unknown().optional(),
  notes: z.string().nullable().optional(),
  status: z.string().optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission("campaign.view");
    const actor = await resolveLeadActor();
    if (!actor) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
    }
    const { id } = await context.params;
    const item = await getCampaign(actor, id);
    return NextResponse.json({ apiVersion: "v2", item });
  } catch (err) {
    return campaignErrorResponse(err);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission("campaign.edit");
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
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid body" } }, { status: 400 });
    }
    const { id } = await context.params;
    const b = parsed.data;
    const item = await patchCampaign(actor, id, {
      ...b,
      startAt: b.startAt ? new Date(b.startAt) : undefined,
      endAt: b.endAt === undefined ? undefined : b.endAt ? new Date(b.endAt) : null,
    } as any);
    return NextResponse.json({ apiVersion: "v2", item });
  } catch (err) {
    return campaignErrorResponse(err);
  }
}
