import { describe, expect, it } from "vitest";

import { aLead } from "../../testing/fixtures/aLead";
import { LeadEvent, LeadPersonType, LeadStatus } from "../enums";
import {
  LeadDncBlockedError,
  LeadDuplicateConversionError,
  LeadGuardFailedError,
  LeadOwnershipDeniedError,
  LeadReactivationWindowExpiredError,
  LeadStateTransitionNotAllowedError,
} from "../errors";
import { TRANSITION_FNS, t01Intake, t29Reactivate, transition } from "./transitions";
import type { GuardFacts, TransitionContext } from "./types";
import { REACTIVATION_WINDOW_DAYS } from "./types";

function facts(over: Partial<GuardFacts> = {}): GuardFacts {
  return {
    hasConsent: true,
    dncBlocked: false,
    isOwner: true,
    isSupervisor: true,
    hasPermission: true,
    requiredFieldsPresent: true,
    hasConversion: false,
    lostAt: new Date("2026-08-01T00:00:00.000Z"),
    isMerged: false,
    counsellorAvailable: true,
    attemptCount: 0,
    maxAttempts: 3,
    configVersionActive: true,
    callRecordAttached: true,
    dueAtPresent: true,
    reasonPresent: true,
    bookingExists: true,
    bookingInFuture: true,
    sessionRecordAttached: true,
    personTypeDonor: true,
    personTypeRecipient: true,
    recommendationRegister: true,
    leadMergeExists: true,
    retentionExpired: true,
    outcomeWon: false,
    assigneeAvailable: true,
    claimAllowed: true,
    publicIntake: true,
    ...over,
  };
}

function ctx(over: Partial<TransitionContext> = {}, factOver: Partial<GuardFacts> = {}): TransitionContext {
  return {
    now: new Date("2026-09-04T12:00:00.000Z"),
    actor: { userId: "user_1", roles: ["OPS_MANAGER"], siteId: "site_1" },
    payload: {
      reason: "because",
      assigneeUserId: "tc_1",
      dueAt: new Date("2026-09-05T12:00:00.000Z"),
      callStartedAt: new Date("2026-09-04T11:00:00.000Z"),
      callEndedAt: new Date("2026-09-04T11:05:00.000Z"),
      counsellorUserId: "c_1",
      scheduledAt: new Date("2026-09-10T09:00:00.000Z"),
      winnerLeadId: "lead_win",
      recommendation: "RECOMMEND_REGISTER",
      score: 40,
      scoreTier: "COLD",
      source: "WEB_FORM",
    },
    facts: facts(factOver),
    ...over,
  };
}

function expectHappy(result: ReturnType<typeof t01Intake>, next: LeadStatus) {
  expect(result.nextStatus).toBe(next);
  expect(result.writes.some((w) => w.kind === "status_history")).toBe(true);
  expect(result.writes.some((w) => w.kind === "activity" && w.activityType === "STATUS_CHANGE")).toBe(true);
  const history = result.writes.find((w) => w.kind === "status_history");
  if (history && history.kind === "status_history") {
    expect(history.toStatus).toBe(next);
  }
}

const CASES: Array<{
  id: keyof typeof TRANSITION_FNS;
  status: LeadStatus | null;
  personType?: LeadPersonType;
  next: LeadStatus;
  extra?: Partial<TransitionContext>;
}> = [
  { id: "T-01", status: null, next: LeadStatus.NEW },
  { id: "T-02", status: LeadStatus.NEW, next: LeadStatus.ASSIGNED },
  { id: "T-03", status: LeadStatus.ASSIGNED, next: LeadStatus.ASSIGNED },
  { id: "T-04", status: LeadStatus.ASSIGNED, next: LeadStatus.ASSIGNED },
  { id: "T-05", status: LeadStatus.ASSIGNED, next: LeadStatus.CONTACTED_QUALIFIED },
  { id: "T-06", status: LeadStatus.ASSIGNED, next: LeadStatus.CONTACTED_NOT_INTERESTED },
  { id: "T-07", status: LeadStatus.ASSIGNED, next: LeadStatus.CONTACTED_CALLBACK_REQUESTED },
  { id: "T-08", status: LeadStatus.ASSIGNED, next: LeadStatus.NOT_REACHABLE },
  { id: "T-09", status: LeadStatus.ASSIGNED, next: LeadStatus.WRONG_NUMBER },
  { id: "T-10", status: LeadStatus.ASSIGNED, next: LeadStatus.DO_NOT_CALL },
  { id: "T-11", status: LeadStatus.CONTACTED_CALLBACK_REQUESTED, next: LeadStatus.CONTACTED_QUALIFIED },
  { id: "T-12", status: LeadStatus.CONTACTED_CALLBACK_REQUESTED, next: LeadStatus.CONTACTED_NOT_INTERESTED },
  { id: "T-13", status: LeadStatus.NOT_REACHABLE, next: LeadStatus.CONTACTED_QUALIFIED },
  { id: "T-14", status: LeadStatus.NOT_REACHABLE, next: LeadStatus.WRONG_NUMBER },
  { id: "T-15", status: LeadStatus.CONTACTED_QUALIFIED, personType: LeadPersonType.RECIPIENT, next: LeadStatus.COUNSELLING_BOOKED },
  { id: "T-16", status: LeadStatus.CONTACTED_QUALIFIED, personType: LeadPersonType.DONOR, next: LeadStatus.CONVERTED },
  { id: "T-17", status: LeadStatus.COUNSELLING_BOOKED, next: LeadStatus.COUNSELLING_ATTENDED },
  { id: "T-18", status: LeadStatus.COUNSELLING_BOOKED, next: LeadStatus.COUNSELLING_NO_SHOW },
  { id: "T-19", status: LeadStatus.COUNSELLING_BOOKED, next: LeadStatus.COUNSELLING_BOOKED },
  { id: "T-20", status: LeadStatus.COUNSELLING_NO_SHOW, next: LeadStatus.COUNSELLING_BOOKED },
  { id: "T-21", status: LeadStatus.COUNSELLING_NO_SHOW, next: LeadStatus.LOST, extra: { facts: facts({ attemptCount: 3, maxAttempts: 3 }) } },
  { id: "T-22", status: LeadStatus.COUNSELLING_ATTENDED, personType: LeadPersonType.RECIPIENT, next: LeadStatus.CONVERTED },
  { id: "T-23", status: LeadStatus.COUNSELLING_ATTENDED, next: LeadStatus.COUNSELLING_ATTENDED },
  { id: "T-24", status: LeadStatus.CONTACTED_NOT_INTERESTED, next: LeadStatus.LOST },
  { id: "T-25", status: LeadStatus.WRONG_NUMBER, next: LeadStatus.LOST },
  { id: "T-26", status: LeadStatus.DO_NOT_CALL, next: LeadStatus.LOST },
  { id: "T-27", status: LeadStatus.ASSIGNED, next: LeadStatus.ASSIGNED },
  { id: "T-28", status: LeadStatus.ASSIGNED, next: LeadStatus.ASSIGNED },
  { id: "T-29", status: LeadStatus.LOST, next: LeadStatus.ASSIGNED },
  { id: "T-30", status: LeadStatus.ASSIGNED, next: LeadStatus.EXPIRED_AUTO_PURGED },
  { id: "T-31", status: LeadStatus.ASSIGNED, next: LeadStatus.LOST },
];

describe("T-01..T-31 happy paths", () => {
  it.each(CASES)("$id → $next", ({ id, status, personType, next, extra }) => {
    const lead =
      status == null
        ? null
        : aLead({
            status,
            personType: personType ?? LeadPersonType.DONOR,
          });
    if (id === "T-28" && lead) {
      Object.assign(lead.props, { isArchived: true });
    }
    const result = TRANSITION_FNS[id](lead, extra ? { ...ctx(), ...extra } : ctx());
    expectHappy(result, next);
    if (id !== "T-19" && id !== "T-23" && id !== "T-28" && id !== "T-30") {
      expect(result.outboxEvents.length + result.writes.filter((w) => w.kind === "outbox").length).toBeGreaterThan(0);
    }
  });
});

describe("denied paths", () => {
  it("T-01 denies missing consent", () => {
    expect(() => t01Intake(null, ctx({}, { hasConsent: false }))).toThrow(LeadGuardFailedError);
  });

  it("T-02 denies from ASSIGNED", () => {
    expect(() =>
      transition(aLead({ status: LeadStatus.ASSIGNED }), LeadEvent.assign, ctx()),
    ).toThrow(LeadStateTransitionNotAllowedError);
  });

  it("T-05 denies non-owner", () => {
    expect(() =>
      TRANSITION_FNS["T-05"](
        aLead({ status: LeadStatus.ASSIGNED }),
        ctx({}, { isOwner: false, isSupervisor: false }),
      ),
    ).toThrow(LeadOwnershipDeniedError);
  });

  it("T-16 denies duplicate conversion", () => {
    expect(() =>
      TRANSITION_FNS["T-16"](
        aLead({ status: LeadStatus.CONTACTED_QUALIFIED, personType: LeadPersonType.DONOR }),
        ctx({}, { hasConversion: true }),
      ),
    ).toThrow(LeadDuplicateConversionError);
  });

  it("T-15 denies DNC", () => {
    expect(() =>
      TRANSITION_FNS["T-15"](
        aLead({ status: LeadStatus.CONTACTED_QUALIFIED, personType: LeadPersonType.RECIPIENT }),
        ctx({}, { dncBlocked: true, personTypeRecipient: true }),
      ),
    ).toThrow(LeadDncBlockedError);
  });

  it("T-29 denies beyond 90 days", () => {
    const lostAt = new Date("2026-01-01T00:00:00.000Z");
    const now = new Date("2026-09-04T00:00:00.000Z");
    expect(now.getTime() - lostAt.getTime()).toBeGreaterThan(REACTIVATION_WINDOW_DAYS * 86400000);
    expect(() =>
      t29Reactivate(
        aLead({ status: LeadStatus.LOST }),
        ctx({ now }, { lostAt }),
      ),
    ).toThrow(LeadReactivationWindowExpiredError);
  });

  it("CONVERTED rejects all events", () => {
    for (const event of [LeadEvent.assign, LeadEvent.archive, LeadEvent.reactivate, LeadEvent.mark_lost]) {
      expect(() =>
        transition(aLead({ status: LeadStatus.CONVERTED }), event, ctx()),
      ).toThrow(LeadStateTransitionNotAllowedError);
    }
  });

  it("EXPIRED_AUTO_PURGED rejects all events", () => {
    expect(() =>
      transition(aLead({ status: LeadStatus.EXPIRED_AUTO_PURGED }), LeadEvent.reactivate, ctx()),
    ).toThrow(LeadStateTransitionNotAllowedError);
  });

  it("LOST rejects non-reactivate events", () => {
    expect(() =>
      transition(aLead({ status: LeadStatus.LOST }), LeadEvent.assign, ctx()),
    ).toThrow(LeadStateTransitionNotAllowedError);
  });
});

describe("invariants I-01/I-03/I-05/I-09/I-14", () => {
  it("I-09 archive writes include archivedAt and archivedByUserId", () => {
    const result = TRANSITION_FNS["T-27"](aLead({ status: LeadStatus.ASSIGNED }), ctx());
    const patch = result.writes.find((w) => w.kind === "lead_patch");
    expect(patch && patch.kind === "lead_patch" && patch.patch.isArchived).toBe(true);
    expect(patch && patch.kind === "lead_patch" && patch.patch.archivedAt).toBeTruthy();
    expect(patch && patch.kind === "lead_patch" && patch.patch.archivedByUserId).toBe("user_1");
  });

  it("I-14 reactivation window is hard-coded 90 days", () => {
    expect(REACTIVATION_WINDOW_DAYS).toBe(90);
  });

  it("I-03 duplicate conversion is refused before writes", () => {
    expect(() =>
      TRANSITION_FNS["T-16"](
        aLead({ status: LeadStatus.CONTACTED_QUALIFIED }),
        ctx({}, { hasConversion: true }),
      ),
    ).toThrow(LeadDuplicateConversionError);
  });
});
