import { NextResponse } from "next/server";

import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { prismaLeadRepository } from "@/lib/leads/adapters/prisma-lead-repository";
import { LeadOwnershipDeniedError } from "@/lib/leads/domain/errors";
import type { Lead } from "@/lib/leads/domain/entities/Lead";
import type { ActorContext } from "@/lib/leads/domain/ports/shared";
import { holdsLeadViewPermission } from "@/lib/rbac-permissions";

/**
 * Exact Lead-detail GET authorization boundary (B17-A §4-F).
 * Permission gate is `holdsLeadViewPermission` — not a reconstructed literal set.
 * Scope narrowing is `prismaLeadRepository.byId` → `evaluateLeadAccess`.
 */
export async function authorizeLeadDetailRead(leadId: string): Promise<
  | { ok: true; actor: ActorContext; lead: Lead }
  | { ok: false; response: NextResponse }
> {
  const actor = await resolveLeadActor();
  if (!actor) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "AUTHENTICATION_REQUIRED", message: "Unauthorized" } },
        { status: 401 },
      ),
    };
  }
  if (!holdsLeadViewPermission(actor.roles)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "PERMISSION_DENIED", message: "Forbidden" } },
        { status: 403 },
      ),
    };
  }
  try {
    const lead = await prismaLeadRepository.byId(leadId, actor);
    if (!lead) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Lead not found" } },
          { status: 404 },
        ),
      };
    }
    return { ok: true, actor, lead };
  } catch (err) {
    if (err instanceof LeadOwnershipDeniedError) {
      const code =
        typeof err.context.denialReason === "string"
          ? err.context.denialReason
          : "OWNERSHIP_DENIED";
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code, message: "Lead not in caller scope" } },
          { status: 403 },
        ),
      };
    }
    throw err;
  }
}
