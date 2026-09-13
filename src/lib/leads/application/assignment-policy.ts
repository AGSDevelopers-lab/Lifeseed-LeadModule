import {
  permissionGranted,
  permissionsForRoles,
  type Permission,
} from "@/lib/rbac-permissions";
import type { AssignmentRules } from "../config/schemas";
import type { TelecallerAvailability } from "../domain/ports/AssignmentDirectory";
import type { ActorContext } from "../domain/ports/shared";
import { LeadOwnershipDeniedError } from "../domain/errors";

/**
 * B13 fallback assignment policy.
 *
 * Temporary semantics pending IAM Module 12: eligibility is active + TELECALLER/SR_TELECALLER
 * + site match (unless assignment.override) + under maxQueuePerTelecaller.
 * No shift, skill, or language matching — those are DEFERRED / IAM-DEPENDENT.
 */

export const ASSIGNMENT_ELIGIBLE_ROLES = ["TELECALLER", "SR_TELECALLER"] as const;

export function actorHasAssignmentOverride(actor: ActorContext): boolean {
  return permissionGranted(
    permissionsForRoles(actor.roles),
    "assignment.override" as Permission,
  );
}

export function isUnrestrictedReassignRole(roles: readonly string[]): boolean {
  return roles.some(
    (r) => r === "OPS_MANAGER" || r === "BANK_SUPER_ADMIN" || r === "SUPER_ADMIN",
  );
}

export function isSrTelecallerOnly(roles: readonly string[]): boolean {
  if (isUnrestrictedReassignRole(roles)) return false;
  return roles.includes("SR_TELECALLER");
}

/**
 * Own pool for SR_TELECALLER = existing User.siteId (no new team/reporting model).
 */
export function assertSrTelecallerOwnPool(
  actor: ActorContext,
  targetSiteId: string | null,
): void {
  if (!isSrTelecallerOnly(actor.roles)) return;
  if (!actor.siteId || !targetSiteId || actor.siteId !== targetSiteId) {
    throw new LeadOwnershipDeniedError(
      "SR_TELECALLER may only reassign within their own site pool",
      { actorSiteId: actor.siteId ?? null, targetSiteId },
    );
  }
}

export function siteMatchesCandidate(
  candidateSiteId: string | null,
  leadSiteId: string | null,
  override: boolean,
  rules: AssignmentRules,
): boolean {
  if (rules.siteMatchingPolicy === "off") return true;
  if (override && rules.crossSiteOverridePolicy === "assignment_override") return true;
  if (!leadSiteId) return true;
  return candidateSiteId === leadSiteId;
}

export function underCapacity(openLeadCount: number, maxQueuePerTelecaller: number): boolean {
  return openLeadCount < maxQueuePerTelecaller;
}

export function eligibleCandidates(
  directory: readonly TelecallerAvailability[],
  leadSiteId: string | null,
  override: boolean,
  rules: AssignmentRules,
): TelecallerAvailability[] {
  return directory.filter(
    (row) =>
      siteMatchesCandidate(row.siteId, leadSiteId, override, rules) &&
      underCapacity(row.openLeadCount, rules.maxQueuePerTelecaller),
  );
}

/**
 * Genuine assigneeAvailable (fallback, not IAM): true iff at least one directory
 * candidate is site-eligible (respecting override) and under capacity.
 * Directory rows are already active + correctly roled.
 */
export function computeAssigneeAvailable(
  directory: readonly TelecallerAvailability[],
  leadSiteId: string | null,
  override: boolean,
  rules: AssignmentRules,
): boolean {
  return eligibleCandidates(directory, leadSiteId, override, rules).length > 0;
}

export function pickFairRotate(eligible: readonly TelecallerAvailability[]): string | null {
  if (eligible.length === 0) return null;
  const min = Math.min(...eligible.map((e) => e.openLeadCount));
  const bucket = eligible
    .filter((e) => e.openLeadCount === min)
    .slice()
    .sort((a, b) => a.userId.localeCompare(b.userId));
  return bucket[0]?.userId ?? null;
}

export function assertLanguagesSkillsEmpty(row: TelecallerAvailability): void {
  if (row.languages.length !== 0 || row.skills.length !== 0) {
    throw new Error("AssignmentDirectory fallback must not fabricate languages or skills");
  }
}
