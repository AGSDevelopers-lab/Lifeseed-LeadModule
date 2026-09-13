import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { $transaction: vi.fn(), leadConversion: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/audit", () => ({
  audit: { log: vi.fn(async () => undefined) },
  createAuditedPrismaClient: vi.fn(),
}));

const convertLeadToDonor = vi.fn();
const convertLeadToRecipient = vi.fn();
vi.mock("../lead-conversion", () => ({
  convertLeadToDonor: (...args: unknown[]) => convertLeadToDonor(...args),
  convertLeadToRecipient: (...args: unknown[]) => convertLeadToRecipient(...args),
}));

const convertDonorStub = vi.fn();
const convertRecipientStub = vi.fn();
vi.mock("./commands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./commands")>();
  return {
    ...actual,
    convertDonorStub: (...args: unknown[]) => convertDonorStub(...args),
    convertRecipientStub: (...args: unknown[]) => convertRecipientStub(...args),
  };
});

import { aLead } from "../testing/fixtures/aLead";
import { LeadEvent, LeadEventType, LeadPersonType, LeadStatus } from "../domain/enums";
import { LeadStateTransitionNotAllowedError } from "../domain/errors";
import { transition } from "../domain/state-machine/transitions";
import type { GuardFacts, TransitionContext } from "../domain/state-machine/types";
import { convertDonor, convertRecipient, type ConvertDeps } from "./convert";
import { FakeAuditPort } from "../testing/fakes/FakeAuditPort";
import { FakeConversionPort } from "../testing/fakes/FakeConversionPort";
import { FakeSlaPort } from "../testing/fakes/FakeSlaPort";
import { InMemoryTransitionStore } from "./testing/in-memory-transition-store";

const extras = { dob: "1990-01-01", gender: "M" as const, siteId: "site_1" };
const actor = { userId: "u1", roles: ["OPS_MANAGER"] };

function facts(over: Partial<GuardFacts> = {}): GuardFacts {
  return {
    hasConsent: true,
    dncBlocked: false,
    isOwner: true,
    isSupervisor: true,
    hasPermission: true,
    requiredFieldsPresent: true,
    hasConversion: false,
    lostAt: null,
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

function ctx(): TransitionContext {
  return {
    now: new Date("2026-09-14T00:00:00.000Z"),
    actor: { userId: "u1", roles: ["OPS_MANAGER"], siteId: null },
    payload: {},
    facts: facts(),
  };
}

function stubDeps(): ConvertDeps {
  const store = new InMemoryTransitionStore();
  return {
    conversion: new FakeConversionPort(),
    store,
    sla: new FakeSlaPort(),
    audit: new FakeAuditPort(),
    flagEnabled: false,
    conversionExists: async () => false,
    persistWithClient: async (_uow, input) => store.persistBundle(input),
    runInTransaction: async (fn) => fn({}),
  };
}

describe("B16 Legacy+stub conversion matrix (flagEnabled=false)", () => {
  afterEach(() => {
    convertLeadToDonor.mockReset();
    convertLeadToRecipient.mockReset();
    convertDonorStub.mockReset();
    convertRecipientStub.mockReset();
  });

  it.each([
    [LeadStatus.CONTACTED_QUALIFIED],
    [LeadStatus.COUNSELLING_ATTENDED],
  ] as const)("donor from %s calls legacy then stub", async (status) => {
    convertLeadToDonor.mockResolvedValue({ ok: true, donorId: "d1" });
    convertDonorStub.mockResolvedValue({});
    const lead = aLead({ status, personType: LeadPersonType.DONOR });
    const result = await convertDonor(lead.id, actor, extras, stubDeps());
    expect(result).toEqual({ ok: true, donorId: "d1" });
    expect(convertLeadToDonor).toHaveBeenCalledWith(
      lead.id,
      actor.userId,
      extras,
      { skipStatusWrite: true },
      actor,
    );
    expect(convertDonorStub).toHaveBeenCalledTimes(1);
  });

  it.each([
    [LeadStatus.CONTACTED_QUALIFIED],
    [LeadStatus.COUNSELLING_ATTENDED],
  ] as const)("recipient from %s calls legacy then stub", async (status) => {
    convertLeadToRecipient.mockResolvedValue({ ok: true, recipientId: "r1" });
    convertRecipientStub.mockResolvedValue({});
    const lead = aLead({ status, personType: LeadPersonType.RECIPIENT });
    const result = await convertRecipient(
      lead.id,
      actor,
      { clinicId: "clinic_1" },
      stubDeps(),
    );
    expect(result).toEqual({ ok: true, recipientId: "r1" });
    expect(convertLeadToRecipient.mock.calls[0]?.[3]).toEqual({ skipStatusWrite: true });
    expect(convertRecipientStub).toHaveBeenCalledTimes(1);
  });

  it("does not call stub when legacy rejects", async () => {
    convertLeadToDonor.mockResolvedValue({ ok: false, error: "Lead already converted" });
    const result = await convertDonor("lead_x", actor, extras, stubDeps());
    expect(result.ok).toBe(false);
    expect(convertDonorStub).not.toHaveBeenCalled();
  });
});

describe("B16 t16/t22 widened assertFrom", () => {
  it("donor CONTACTED_QUALIFIED and COUNSELLING_ATTENDED emit one LeadConverted write", () => {
    for (const status of [LeadStatus.CONTACTED_QUALIFIED, LeadStatus.COUNSELLING_ATTENDED]) {
      const lead = aLead({ status, personType: LeadPersonType.DONOR });
      const result = transition(lead, LeadEvent.convert_donor, ctx());
      const converted = result.writes.filter(
        (w) => w.kind === "outbox" && w.eventType === LeadEventType.LeadConverted,
      );
      expect(result.nextStatus).toBe(LeadStatus.CONVERTED);
      expect(converted).toHaveLength(1);
    }
  });

  it("recipient CONTACTED_QUALIFIED and COUNSELLING_ATTENDED emit one LeadConverted write", () => {
    for (const status of [LeadStatus.CONTACTED_QUALIFIED, LeadStatus.COUNSELLING_ATTENDED]) {
      const lead = aLead({ status, personType: LeadPersonType.RECIPIENT });
      const result = transition(
        lead,
        LeadEvent.convert_recipient,
        { ...ctx(), facts: facts({ personTypeDonor: false, personTypeRecipient: true }) },
      );
      const converted = result.writes.filter(
        (w) => w.kind === "outbox" && w.eventType === LeadEventType.LeadConverted,
      );
      expect(result.nextStatus).toBe(LeadStatus.CONVERTED);
      expect(converted).toHaveLength(1);
    }
  });

  it("rejects donor and recipient from statuses outside the two allowed", () => {
    const outside = [
      LeadStatus.NEW,
      LeadStatus.ASSIGNED,
      LeadStatus.LOST,
      LeadStatus.COUNSELLING_BOOKED,
    ];
    for (const status of outside) {
      expect(() =>
        transition(aLead({ status, personType: LeadPersonType.DONOR }), LeadEvent.convert_donor, ctx()),
      ).toThrow(LeadStateTransitionNotAllowedError);
      expect(() =>
        transition(
          aLead({ status, personType: LeadPersonType.RECIPIENT }),
          LeadEvent.convert_recipient,
          { ...ctx(), facts: facts({ personTypeDonor: false, personTypeRecipient: true }) },
        ),
      ).toThrow(LeadStateTransitionNotAllowedError);
    }
  });

  it("already CONVERTED is rejected by assertFrom before outbox write", () => {
    expect(() =>
      transition(
        aLead({ status: LeadStatus.CONVERTED, personType: LeadPersonType.DONOR }),
        LeadEvent.convert_donor,
        ctx(),
      ),
    ).toThrow(LeadStateTransitionNotAllowedError);
  });
});
