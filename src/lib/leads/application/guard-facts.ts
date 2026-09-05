import { permissionGranted, permissionsForRoles, type Permission } from "@/lib/rbac";
import type { UserRole } from "@prisma/client";
import type { Lead } from "../domain/entities/Lead";
import type { ActorContext } from "../domain/ports/shared";
import { LeadStatus } from "../domain/enums";
import type { GuardFacts } from "../domain/state-machine/types";

const SUPERVISOR_ROLES = new Set(["OPS_MANAGER", "BANK_SUPER_ADMIN"]);

export function isSupervisor(roles: readonly string[]): boolean {
  return roles.some((r) => SUPERVISOR_ROLES.has(r));
}

export function buildGuardFacts(input: {
  lead: Lead | null;
  actor: ActorContext;
  hasPermission: boolean;
  dncBlocked?: boolean;
  hasConversion?: boolean;
  lostAt?: Date | null;
  counsellorAvailable?: boolean;
  attemptCount?: number;
  maxAttempts?: number;
  configVersionActive?: boolean;
  callRecordAttached?: boolean;
  dueAtPresent?: boolean;
  reasonPresent?: boolean;
  bookingExists?: boolean;
  bookingInFuture?: boolean;
  sessionRecordAttached?: boolean;
  recommendationRegister?: boolean;
  leadMergeExists?: boolean;
  retentionExpired?: boolean;
  assigneeAvailable?: boolean;
  claimAllowed?: boolean;
  publicIntake?: boolean;
  requiredFieldsPresent?: boolean;
  hasConsent?: boolean;
}): GuardFacts {
  const lead = input.lead;
  const ownerId = lead?.props.ownership.assignedTelecallerId ?? null;
  return {
    hasConsent: input.hasConsent ?? Boolean(lead?.props.consent.dataProcessing),
    dncBlocked: input.dncBlocked ?? false,
    isOwner: !ownerId || ownerId === input.actor.userId,
    isSupervisor: isSupervisor(input.actor.roles),
    hasPermission: input.hasPermission,
    requiredFieldsPresent:
      input.requiredFieldsPresent ??
      Boolean(lead?.props.contact.fullName && lead?.props.contact.phone),
    hasConversion: input.hasConversion ?? Boolean(lead?.props.conversion.convertedDonorId || lead?.props.conversion.convertedRecipientId),
    lostAt: input.lostAt ?? (lead?.status === LeadStatus.LOST ? lead.props.retention.capturedAt : null),
    isMerged: Boolean(lead?.props.merge.mergedIntoLeadId) || lead?.props.outcome === "MERGED",
    counsellorAvailable: input.counsellorAvailable ?? true,
    attemptCount: input.attemptCount ?? 0,
    maxAttempts: input.maxAttempts ?? 3,
    configVersionActive: input.configVersionActive ?? true,
    callRecordAttached: input.callRecordAttached ?? true,
    dueAtPresent: input.dueAtPresent ?? false,
    reasonPresent: input.reasonPresent ?? false,
    bookingExists: input.bookingExists ?? false,
    bookingInFuture: input.bookingInFuture ?? false,
    sessionRecordAttached: input.sessionRecordAttached ?? false,
    personTypeDonor: lead?.props.personType === "DONOR",
    personTypeRecipient: lead?.props.personType === "RECIPIENT",
    recommendationRegister: input.recommendationRegister ?? false,
    leadMergeExists: input.leadMergeExists ?? false,
    retentionExpired: input.retentionExpired ?? false,
    outcomeWon: lead?.props.outcome === "WON",
    assigneeAvailable: input.assigneeAvailable ?? true,
    claimAllowed: input.claimAllowed ?? (!ownerId || ownerId === input.actor.userId || isSupervisor(input.actor.roles)),
    publicIntake: input.publicIntake ?? false,
  };
}

export function mapWorkflowPermission(perm: string): string {
  const map: Record<string, string> = {
    "lead.intake": "lead.create",
    "lead.disposition": "telecaller.disposition",
    "lead.claim": "telecaller.disposition",
    "lead.reassign": "lead.assign",
    "lead.unarchive": "lead.archive",
    "lead.reactivate": "lead.archive",
    "lead.merge": "lead.assign",
    "counselling.session.record": "counsellor.mark_attended",
    "counselling.outcome.record": "counsellor.mark_attended",
    "lead.convert.recipient": "lead.convert",
  };
  return map[perm] ?? perm;
}

export async function actorHasPerm(actor: ActorContext, workflowPerm: string): Promise<boolean> {
  const mapped = mapWorkflowPermission(workflowPerm) as Permission;
  return permissionGranted(permissionsForRoles(actor.roles as UserRole[]), mapped);
}

