import { NextResponse } from "next/server";

import { isLead360Enabled } from "@/lib/leads/application/feature-flag";
import { authorizeLeadDetailRead } from "@/lib/leads/application/lead-detail-read-auth";
import { getLeadCrmStatus } from "@/lib/leads/application/lead-crm-status";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isLead360Enabled()) {
    return NextResponse.json(
      { error: { code: "FEATURE_OFF", message: "Lead 360 is disabled" } },
      { status: 404 },
    );
  }
  const { id } = await context.params;
  const auth = await authorizeLeadDetailRead(id);
  if (!auth.ok) return auth.response;
  const body = await getLeadCrmStatus(id);
  return NextResponse.json(body);
}
