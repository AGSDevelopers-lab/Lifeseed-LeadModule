import type { LeadListFilters } from "../domain/ports/LeadRepository";
import type { ActorContext } from "../domain/ports/shared";
import {
  holdsLeadViewAny,
  holdsLeadViewPermission,
} from "@/lib/rbac-permissions";

export type LeadAccessSnapshot = {
  leadId: string;
  assignedTelecallerId: string | null;
  counsellorUserId: string | null;
  counsellorUserIds?: string[];
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

function isSiteScopedViewer(ctx: ActorContext, roles: Set<string>): boolean {
  if (isCrossSiteAdmin(roles)) return false;
  return holdsLeadViewAny(ctx.roles);
}

function counsellorMatch(lead: LeadAccessSnapshot, userId: string): boolean {
  if (lead.counsellorUserIds && lead.counsellorUserIds.includes(userId)) return true;
  return Boolean(lead.counsellorUserId && lead.counsellorUserId === userId);
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
 * BANK_SUPER_ADMIN is cross-site. Actors with `lead.view.any` (OPS / marketing)
 * are site-scoped. Telecallers (incl. SR_TELECALLER) see assigned leads only.
 * Counsellors see booked leads only. BANK_MEDICAL_DIRECTOR has no case-level view.
 */
export function evaluateLeadAccess(
  lead: LeadAccessSnapshot,
  ctx: ActorContext,
): LeadAccessDecision {
  const roles = roleSet(ctx.roles);

  if (!holdsLeadViewPermission(ctx.roles)) {
    return {
      allowed: false,
      denialReason: "PERMISSION_DENIED",
      requiredPermission: "lead.view.own",
    };
  }

  if (isCrossSiteAdmin(roles)) {
    return { allowed: true };
  }

  if (isSiteScopedViewer(ctx, roles)) {
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
    if (counsellorMatch(lead, ctx.userId)) {
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
    if (counsellorMatch(lead, ctx.userId)) {
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
    requiredPermission: "lead.view.own",
  };
}

/** Prisma `where` fragment for list queries — same ownership/site rules as byId. */
export function leadListScopeWhere(ctx: ActorContext): Record<string, unknown> {
  const roles = roleSet(ctx.roles);
  if (!holdsLeadViewPermission(ctx.roles)) {
    return { id: "__no_lead_scope__" };
  }
  if (isCrossSiteAdmin(roles)) {
    return {};
  }
  if (isSiteScopedViewer(ctx, roles)) {
    if (!ctx.siteId) return {};
    return { assignedTelecaller: { siteId: ctx.siteId } };
  }
  if (roles.has("COUNSELLOR") && !isTelecaller(roles)) {
    return { counsellingBookings: { some: { counsellorUserId: ctx.userId } } };
  }
  if (isTelecaller(roles)) {
    return { assignedTelecallerId: ctx.userId };
  }
  if (roles.has("COUNSELLOR")) {
    return { counsellingBookings: { some: { counsellorUserId: ctx.userId } } };
  }
  return { id: "__no_lead_scope__" };
}

export function mergeLeadListFilters(
  scope: Record<string, unknown>,
  filters: LeadListFilters | undefined,
): Record<string, unknown> {
  const where: Record<string, unknown> = { ...scope };
  if (!filters) return where;
  if (filters.source) where.source = filters.source;
  if (filters.tier) where.tier = filters.tier;
  if (filters.status) {
    where.status = filters.status;
  } else if (filters.statuses && filters.statuses.length > 0) {
    where.status = { in: filters.statuses };
  }
  if (filters.statusNot) {
    where.NOT = [
      ...(Array.isArray(where.NOT) ? where.NOT : where.NOT ? [where.NOT] : []),
      { status: filters.statusNot },
    ];
  }
  if (filters.statusNotIn && filters.statusNotIn.length > 0) {
    const prev = where.status;
    if (prev && typeof prev === "object" && "in" in prev) {
      where.status = { in: prev.in, notIn: filters.statusNotIn };
    } else if (typeof prev === "string") {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        { status: { notIn: filters.statusNotIn } },
      ];
    } else {
      where.status = { notIn: filters.statusNotIn };
    }
  }
  if (filters.outcome) where.outcome = filters.outcome;
  if (filters.convertedByUserId) where.convertedByUserId = filters.convertedByUserId;
  if (filters.slaResponseDueBefore) {
    where.slaResponseDueAt = { lte: filters.slaResponseDueBefore };
  }
  if (filters.convertedAtFrom) {
    where.convertedAt = { gte: filters.convertedAtFrom };
  }
  if (filters.retentionExpiresAtTo) {
    where.retentionExpiresAt = { lte: filters.retentionExpiresAtTo };
  }
  if (filters.isArchived !== undefined) where.isArchived = filters.isArchived;
  if (filters.personType) where.personType = filters.personType;
  if (filters.campaignId) where.campaignId = filters.campaignId;
  if (filters.telecallerId) where.assignedTelecallerId = filters.telecallerId;
  if (filters.siteId) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { assignedTelecaller: { siteId: filters.siteId } },
    ];
  }
  if (filters.from || filters.to) {
    where.capturedAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  return where;
}

export function encodeLeadCursor(capturedAt: Date, id: string): string {
  return Buffer.from(`${capturedAt.toISOString()}|${id}`, "utf8").toString("base64url");
}

export function decodeLeadCursor(cursor: string): { capturedAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const idx = raw.lastIndexOf("|");
    if (idx < 0) return null;
    const capturedAt = new Date(raw.slice(0, idx));
    if (Number.isNaN(capturedAt.getTime())) return null;
    return { capturedAt, id: raw.slice(idx + 1) };
  } catch {
    return null;
  }
}
