export type LeadErrorContext = Record<string, unknown>;

export class LeadDomainError extends Error {
  readonly code: string;
  readonly context: LeadErrorContext;

  constructor(code: string, message: string, context: LeadErrorContext = {}) {
    super(message);
    this.name = "LeadDomainError";
    this.code = code;
    this.context = context;
  }
}

export class LeadStateTransitionNotAllowedError extends LeadDomainError {
  constructor(message: string, context: LeadErrorContext = {}) {
    super("LEAD_STATE_TRANSITION_NOT_ALLOWED", message, context);
    this.name = "LeadStateTransitionNotAllowedError";
  }
}

export class LeadGuardFailedError extends LeadDomainError {
  constructor(message: string, context: LeadErrorContext = {}) {
    super("LEAD_GUARD_FAILED", message, context);
    this.name = "LeadGuardFailedError";
  }
}

export class LeadDuplicateConversionError extends LeadDomainError {
  constructor(message: string, context: LeadErrorContext = {}) {
    super("LEAD_DUPLICATE_CONVERSION", message, context);
    this.name = "LeadDuplicateConversionError";
  }
}

export class LeadMergeAlreadyExistsError extends LeadDomainError {
  constructor(message: string, context: LeadErrorContext = {}) {
    super("LEAD_MERGE_ALREADY_EXISTS", message, context);
    this.name = "LeadMergeAlreadyExistsError";
  }
}

export class LeadConvertedMergeLoserError extends LeadDomainError {
  constructor(message: string, context: LeadErrorContext = {}) {
    super("LEAD_CONVERTED_MERGE_LOSER", message, context);
    this.name = "LeadConvertedMergeLoserError";
  }
}

export class LeadReactivationWindowExpiredError extends LeadDomainError {
  constructor(message: string, context: LeadErrorContext = {}) {
    super("LEAD_REACTIVATION_WINDOW_EXPIRED", message, context);
    this.name = "LeadReactivationWindowExpiredError";
  }
}

export class LeadDncBlockedError extends LeadDomainError {
  constructor(message: string, context: LeadErrorContext = {}) {
    super("LEAD_DNC_BLOCKED", message, context);
    this.name = "LeadDncBlockedError";
  }
}

export class LeadOwnershipDeniedError extends LeadDomainError {
  constructor(message: string, context: LeadErrorContext = {}) {
    super("LEAD_OWNERSHIP_DENIED", message, context);
    this.name = "LeadOwnershipDeniedError";
  }
}

export class LeadConfigVersionMismatchError extends LeadDomainError {
  constructor(message: string, context: LeadErrorContext = {}) {
    super("LEAD_CONFIG_VERSION_MISMATCH", message, context);
    this.name = "LeadConfigVersionMismatchError";
  }
}

export class LeadInvariantViolationError extends LeadDomainError {
  constructor(message: string, context: LeadErrorContext = {}) {
    super("LEAD_INVARIANT_VIOLATION", message, context);
    this.name = "LeadInvariantViolationError";
  }
}

export class LeadPermissionDeniedError extends LeadDomainError {
  constructor(message: string, context: LeadErrorContext = {}) {
    super("LEAD_PERMISSION_DENIED", message, context);
    this.name = "LeadPermissionDeniedError";
  }
}

export class CampaignIllegalTransitionError extends LeadDomainError {
  constructor(message: string, context: LeadErrorContext = {}) {
    super("CAMPAIGN_ILLEGAL_TRANSITION", message, context);
    this.name = "CampaignIllegalTransitionError";
  }
}
