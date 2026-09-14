import { NextResponse } from "next/server";

import { authorizeLeadDetailRead } from "@/lib/leads/application/lead-detail-read-auth";
import { serializeLeadListItem } from "@/lib/leads/application/serialize-lead";
import { prismaLeadAudit } from "@/lib/leads/adapters/prisma-audit";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await authorizeLeadDetailRead(id);
  if (!auth.ok) return auth.response;
  await prismaLeadAudit.recordView({
    actorUserId: auth.actor.userId,
    actorRoles: auth.actor.roles,
    leadId: id,
    siteId: auth.actor.siteId ?? auth.lead.props.ownership.siteId,
  });
  return NextResponse.json({
    apiVersion: "v2",
    lead: serializeLeadListItem(auth.lead),
  });
}
