import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prismaLeadRepository } from "@/lib/leads/adapters/prisma-lead-repository";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { serializeLeadListItem } from "@/lib/leads/application/serialize-lead";
import { prismaLeadAudit } from "@/lib/leads/adapters/prisma-audit";
import {
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

export async function GET(req: NextRequest) {
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

  const url = req.nextUrl;
  const page = await prismaLeadRepository.list(actor, {
    source: url.searchParams.get("source") ?? undefined,
    tier: url.searchParams.get("tier") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    outcome: url.searchParams.get("outcome") ?? undefined,
    personType: url.searchParams.get("personType") ?? undefined,
    siteId: url.searchParams.get("siteId") ?? undefined,
    campaignId: url.searchParams.get("campaignId") ?? undefined,
    telecallerId: url.searchParams.get("telecallerId") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit")
      ? Number(url.searchParams.get("limit"))
      : 50,
    isArchived:
      url.searchParams.get("isArchived") === "true"
        ? true
        : url.searchParams.get("isArchived") === "false"
          ? false
          : undefined,
  });

  await prismaLeadAudit.recordView({
    actorUserId: actor.userId,
    actorRoles: actor.roles,
    leadId: "list",
    siteId: actor.siteId ?? null,
  });

  return NextResponse.json({
    apiVersion: "v2",
    items: page.items.map(serializeLeadListItem),
    nextCursor: page.nextCursor,
  });
}
