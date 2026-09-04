import type { ActorContext } from "../domain/ports/shared";

export type LeadAccessSnapshot = {
  leadId: string;
  assignedTelecallerId: string | null;
  counsellorUserId: string | null;
  /** Resolved site for scoping (Lead.siteId is not on the v1 Prisma model; use assignee site). */
  siteId: string | null;
};

export type LeadAccessDecision =
  | { allowed: true }
  | {
      allowed: false;
      denialReason: string;
      requiredPermission: string;
    };

function roleSet(roles: readonly string[]): Set<string> {
  const s = new Set<string>();
  for (const r of roles) {
    s.add(r);
    if (r === "BANK_SUPER_ADMIN" || r === "SUPER_ADMIN") {
      s.add("BANK_SUPER_ADMIN");
      s.add("SUPER_ADMIN");
    }
    if (r === "BANK_MEDICAL_DIRECTOR" || r === "MED_DIR") {
      s.add("BANK_MEDICAL_DIRECTOR");
      s.add("MED_DIR");
    }
    if (r === "MARKETING_MANAGER" || r === "MARKETING_MGR") {
      s.add("MARKETING_MANAGER");
      s.add("MARKETING_MGR");
    }
    if (r === "SR_TELECALLER") s.add("SR_TELECALLER");
  }
  return s;
}

function isCrossSiteAdmin(roles: Set<string>): boolean {
  return roles.has("BANK_SUPER_ADMIN") || roles.has("SUPER_ADMIN");
}

function isSiteScopedViewer(roles: Set<string>): boolean {
  return (
    roles.has("OPS_MANAGER") ||
    roles.has("MARKETING_MANAGER") ||
    roles.has("MARKETING_MGR") ||
    roles.has("BANK_MEDICAL_DIRECTOR") ||
    roles.has("MED_DIR") ||
    roles.has("CRM_ADMIN")
  );
}

function isTelecaller(roles: Set<string>): boolean {
  return roles.has("TELECALLER") || roles.has("SR_TELECALLER");
}

function siteMatches(actorSiteId: string | null | undefined, leadSiteId: string | null): boolean {
  if (!actorSiteId) return true;
  if (!leadSiteId) return true;
  return actorSiteId === leadSiteId;
}

/**
 * Query-time ownership / site scope for Lead.byId.
 * SUPER_ADMIN is cross-site. OPS / marketing / medical director are site-scoped.
 * Telecallers (incl. SR_TELECALLER) see assigned leads only. Counsellors see booked leads only.
 */
export function evaluateLeadAccess(
  lead: LeadAccessSnapshot,
  ctx: ActorContext,
): LeadAccessDecision {
  const roles = roleSet(ctx.roles);

  if (isCrossSiteAdmin(roles)) {
    return { allowed: true };
  }

  if (isSiteScopedViewer(roles)) {
    if (!siteMatches(ctx.siteId, lead.siteId)) {
      return {
        allowed: false,
        denialReason: "SITE_SCOPE_VIOLATION",
        requiredPermission: "lead.view.any",
      };
    }
    return { allowed: true };
  }

  if (roles.has("COUNSELLOR") && !isTelecaller(roles)) {
    if (lead.counsellorUserId && lead.counsellorUserId === ctx.userId) {
      return { allowed: true };
    }
    return {
      allowed: false,
      denialReason: "OWNERSHIP_DENIED",
      requiredPermission: "lead.view.assigned_for_counselling",
    };
  }

  if (isTelecaller(roles)) {
    if (
      lead.assignedTelecallerId &&
      lead.assignedTelecallerId === ctx.userId
    ) {
      return { allowed: true };
    }
    return {
      allowed: false,
      denialReason: "OWNERSHIP_DENIED",
      requiredPermission: "lead.view.own",
    };
  }

  if (roles.has("COUNSELLOR")) {
    if (lead.counsellorUserId && lead.counsellorUserId === ctx.userId) {
      return { allowed: true };
    }
    return {
      allowed: false,
      denialReason: "OWNERSHIP_DENIED",
      requiredPermission: "lead.view.assigned_for_counselling",
    };
  }

  return {
    allowed: false,
    denialReason: "PERMISSION_DENIED",
    requiredPermission: "lead.view",
  };
}
