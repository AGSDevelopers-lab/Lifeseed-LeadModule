import { NextResponse } from "next/server";

import { prismaLeadRepository } from "@/lib/leads/adapters/prisma-lead-repository";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { serializeLeadListItem } from "@/lib/leads/application/serialize-lead";
import { prismaLeadAudit } from "@/lib/leads/adapters/prisma-audit";
import { LeadOwnershipDeniedError } from "@/lib/leads/domain/errors";
import {
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await resolveLeadActor();
  if (!actor) {
    return NextResponse.json(
      { error: { code: "AUTHENTICATION_REQUIRED", message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const held = permissionsForRoles(actor.roles as never);
  const canView =
    permissionGranted(held, "lead.view.any") ||
    permissionGranted(held, "lead.view.own") ||
    permissionGranted(held, "lead.view.assigned_for_counselling") ||
    permissionGranted(held, "lead.view") ||
    permissionGranted(held, "lead.list");
  if (!canView) {
    return NextResponse.json(
      { error: { code: "PERMISSION_DENIED", message: "Forbidden" } },
      { status: 403 },
    );
  }
  const { id } = await context.params;
  try {
    const lead = await prismaLeadRepository.byId(id, actor);
    if (!lead) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Lead not found" } },
        { status: 404 },
      );
    }
    await prismaLeadAudit.recordView({
      actorUserId: actor.userId,
      actorRoles: actor.roles,
      leadId: id,
      siteId: actor.siteId ?? lead.props.ownership.siteId,
    });
    return NextResponse.json({
      apiVersion: "v2",
      lead: serializeLeadListItem(lead),
    });
  } catch (err) {
    if (err instanceof LeadOwnershipDeniedError) {
      const code =
        typeof err.context.denialReason === "string"
          ? err.context.denialReason
          : "OWNERSHIP_DENIED";
      return NextResponse.json(
        { error: { code, message: "Lead not in caller scope" } },
        { status: 403 },
      );
    }
    throw err;
  }
}
