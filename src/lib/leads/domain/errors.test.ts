import { describe, expect, it } from "vitest";

import {
  LeadConfigVersionMismatchError,
  LeadDncBlockedError,
  LeadDomainError,
  LeadDuplicateConversionError,
  LeadGuardFailedError,
  LeadInvariantViolationError,
  LeadMergeAlreadyExistsError,
  LeadOwnershipDeniedError,
  LeadReactivationWindowExpiredError,
  LeadStateTransitionNotAllowedError,
} from "./errors";

const cases: Array<new (message: string, context?: Record<string, unknown>) => LeadDomainError> = [
  LeadStateTransitionNotAllowedError,
  LeadGuardFailedError,
  LeadDuplicateConversionError,
  LeadMergeAlreadyExistsError,
  LeadReactivationWindowExpiredError,
  LeadDncBlockedError,
  LeadOwnershipDeniedError,
  LeadConfigVersionMismatchError,
  LeadInvariantViolationError,
];

describe("Lead domain errors", () => {
  it.each(cases)("%s constructs with code + context", (Ctor) => {
    const err = new Ctor("boom", { leadId: "abc" });
    expect(err).toBeInstanceOf(LeadDomainError);
    expect(err.message).toBe("boom");
    expect(err.context).toEqual({ leadId: "abc" });
    expect(err.code.length).toBeGreaterThan(0);
  });
});
