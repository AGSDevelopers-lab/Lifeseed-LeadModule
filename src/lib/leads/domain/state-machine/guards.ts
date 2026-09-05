import {
  LeadDncBlockedError,
  LeadDuplicateConversionError,
  LeadGuardFailedError,
  LeadOwnershipDeniedError,
  LeadReactivationWindowExpiredError,
} from "../errors";
import type { Lead } from "../entities/Lead";
import { REACTIVATION_WINDOW_DAYS, type GuardFacts, type TransitionContext } from "./types";

export type GuardName =
  | "hasConsent"
  | "notInDnc"
  | "ownershipCheck"
  | "permissionCheck"
  | "hasRequiredFields"
  | "noDuplicateConversion"
  | "withinReactivationWindow"
  | "notMerged"
  | "counsellorAvailable"
  | "attemptsRemaining"
  | "attemptsExhausted"
  | "configVersionActive"
  | "callRecordAttached"
  | "dueAtSupplied"
  | "reasonSupplied"
  | "bookingExists"
  | "bookingInFuture"
  | "sessionRecordAttached"
  | "personTypeDonor"
  | "personTypeRecipient"
  | "recommendationRegister"
  | "leadMergeExists"
  | "retentionExpired"
  | "assigneeAvailable"
  | "claimAllowed"
  | "notArchivedRequired"
  | "isArchivedRequired";

function fail(guardName: GuardName, reason: string, extra: Record<string, unknown> = {}): never {
  throw new LeadGuardFailedError(reason, { guardName, ...extra });
}

export function hasConsent(_lead: Lead | null, facts: GuardFacts): boolean {
  if (!facts.hasConsent) fail("hasConsent", "Required consent not captured");
  return true;
}

export function notInDnc(_lead: Lead | null, facts: GuardFacts): boolean {
  if (facts.dncBlocked) {
    throw new LeadDncBlockedError("Contact is on the Do Not Call list", {
      guardName: "notInDnc",
    });
  }
  return true;
}

export function ownershipCheck(_lead: Lead | null, facts: GuardFacts): boolean {
  if (facts.isSupervisor) return true;
  if (!facts.isOwner) {
    throw new LeadOwnershipDeniedError("Actor is not the lead owner", {
      guardName: "ownershipCheck",
    });
  }
  return true;
}

export function permissionCheck(_lead: Lead | null, facts: GuardFacts): boolean {
  if (!facts.hasPermission && !facts.publicIntake) {
    fail("permissionCheck", "Actor lacks required permission");
  }
  return true;
}

export function hasRequiredFields(_lead: Lead | null, facts: GuardFacts): boolean {
  if (!facts.requiredFieldsPresent) {
    fail("hasRequiredFields", "Required fields missing for this transition");
  }
  return true;
}

export function noDuplicateConversion(_lead: Lead | null, facts: GuardFacts): boolean {
  if (facts.hasConversion) {
    throw new LeadDuplicateConversionError("Lead already converted", {
      guardName: "noDuplicateConversion",
    });
  }
  return true;
}

export function withinReactivationWindow(
  _lead: Lead | null,
  facts: GuardFacts,
  now: Date,
): boolean {
  if (!facts.lostAt) {
    fail("withinReactivationWindow", "lostAt is required for reactivation");
  }
  const windowMs = REACTIVATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (now.getTime() - facts.lostAt.getTime() > windowMs) {
    throw new LeadReactivationWindowExpiredError(
      "Reactivation window of 90 days has expired",
      {
        guardName: "withinReactivationWindow",
        lostAt: facts.lostAt.toISOString(),
        now: now.toISOString(),
        windowDays: REACTIVATION_WINDOW_DAYS,
      },
    );
  }
  return true;
}

export function notMerged(_lead: Lead | null, facts: GuardFacts): boolean {
  if (facts.isMerged) fail("notMerged", "Merged leads cannot be reactivated");
  return true;
}

export function counsellorAvailable(_lead: Lead | null, facts: GuardFacts): boolean {
  if (!facts.counsellorAvailable) {
    fail("counsellorAvailable", "Counsellor slot is not available");
  }
  return true;
}

export function attemptsRemaining(_lead: Lead | null, facts: GuardFacts): boolean {
  if (facts.attemptCount >= facts.maxAttempts) {
    fail("attemptsRemaining", "Retry / rebook attempts exhausted", {
      attemptCount: facts.attemptCount,
      maxAttempts: facts.maxAttempts,
    });
  }
  return true;
}

export function attemptsExhausted(_lead: Lead | null, facts: GuardFacts): boolean {
  if (facts.attemptCount < facts.maxAttempts) {
    fail("attemptsExhausted", "Attempts remaining; auto-lost not permitted", {
      attemptCount: facts.attemptCount,
      maxAttempts: facts.maxAttempts,
    });
  }
  return true;
}

export function configVersionActive(_lead: Lead | null, facts: GuardFacts): boolean {
  if (!facts.configVersionActive) {
    fail("configVersionActive", "Required config version is not active");
  }
  return true;
}

const GUARD_RUNNERS: Record<
  GuardName,
  (lead: Lead | null, ctx: TransitionContext) => boolean
> = {
  hasConsent: (lead, ctx) => hasConsent(lead, ctx.facts),
  notInDnc: (lead, ctx) => notInDnc(lead, ctx.facts),
  ownershipCheck: (lead, ctx) => ownershipCheck(lead, ctx.facts),
  permissionCheck: (lead, ctx) => permissionCheck(lead, ctx.facts),
  hasRequiredFields: (lead, ctx) => hasRequiredFields(lead, ctx.facts),
  noDuplicateConversion: (lead, ctx) => noDuplicateConversion(lead, ctx.facts),
  withinReactivationWindow: (lead, ctx) =>
    withinReactivationWindow(lead, ctx.facts, ctx.now),
  notMerged: (lead, ctx) => notMerged(lead, ctx.facts),
  counsellorAvailable: (lead, ctx) => counsellorAvailable(lead, ctx.facts),
  attemptsRemaining: (lead, ctx) => attemptsRemaining(lead, ctx.facts),
  attemptsExhausted: (lead, ctx) => attemptsExhausted(lead, ctx.facts),
  configVersionActive: (lead, ctx) => configVersionActive(lead, ctx.facts),
  callRecordAttached: (_lead, ctx) => {
    if (!ctx.facts.callRecordAttached) fail("callRecordAttached", "Call record required");
    return true;
  },
  dueAtSupplied: (_lead, ctx) => {
    if (!ctx.facts.dueAtPresent) fail("dueAtSupplied", "dueAt is required");
    return true;
  },
  reasonSupplied: (_lead, ctx) => {
    if (!ctx.facts.reasonPresent) fail("reasonSupplied", "Reason is required");
    return true;
  },
  bookingExists: (_lead, ctx) => {
    if (!ctx.facts.bookingExists) fail("bookingExists", "Counselling booking required");
    return true;
  },
  bookingInFuture: (_lead, ctx) => {
    if (!ctx.facts.bookingInFuture) fail("bookingInFuture", "Booking must be in the future");
    return true;
  },
  sessionRecordAttached: (_lead, ctx) => {
    if (!ctx.facts.sessionRecordAttached) {
      fail("sessionRecordAttached", "Session record required");
    }
    return true;
  },
  personTypeDonor: (_lead, ctx) => {
    if (!ctx.facts.personTypeDonor) fail("personTypeDonor", "Lead must be a donor");
    return true;
  },
  personTypeRecipient: (_lead, ctx) => {
    if (!ctx.facts.personTypeRecipient) {
      fail("personTypeRecipient", "Lead must be a recipient");
    }
    return true;
  },
  recommendationRegister: (_lead, ctx) => {
    if (!ctx.facts.recommendationRegister) {
      fail("recommendationRegister", "Counselling recommendation must be RECOMMEND_REGISTER");
    }
    return true;
  },
  leadMergeExists: (_lead, ctx) => {
    if (!ctx.facts.leadMergeExists) fail("leadMergeExists", "LeadMerge row required");
    return true;
  },
  retentionExpired: (_lead, ctx) => {
    if (!ctx.facts.retentionExpired || ctx.facts.outcomeWon) {
      fail("retentionExpired", "Retention expiry conditions not met");
    }
    return true;
  },
  assigneeAvailable: (_lead, ctx) => {
    if (!ctx.facts.assigneeAvailable) {
      fail("assigneeAvailable", "No on-shift assignee in matching scope");
    }
    return true;
  },
  claimAllowed: (_lead, ctx) => {
    if (!ctx.facts.claimAllowed) fail("claimAllowed", "Lead is not claimable by this actor");
    return true;
  },
  notArchivedRequired: (lead) => {
    if (lead?.props.isArchived) fail("notArchivedRequired", "Lead is already archived");
    return true;
  },
  isArchivedRequired: (lead) => {
    if (!lead?.props.isArchived) fail("isArchivedRequired", "Lead is not archived");
    return true;
  },
};

export function evaluateGuards(
  names: readonly GuardName[],
  lead: Lead | null,
  ctx: TransitionContext,
): readonly GuardName[] {
  for (const name of names) {
    GUARD_RUNNERS[name](lead, ctx);
  }
  return names;
}
