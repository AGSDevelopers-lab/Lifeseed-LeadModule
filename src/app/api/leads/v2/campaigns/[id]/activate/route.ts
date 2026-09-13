import { NextResponse } from "next/server";

import { activateCampaign } from "@/lib/leads/application/campaign";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { requirePermission } from "@/lib/rbac";

import { campaignErrorResponse } from "../../route";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission("campaign.activate");
    const actor = await resolveLeadActor();
    if (!actor) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
    }
    const { id } = await context.params;
    const item = await activateCampaign(actor, id);
    return NextResponse.json({ apiVersion: "v2", item });
  } catch (err) {
    return campaignErrorResponse(err);
  }
}
