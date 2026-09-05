import { afterEach, describe, expect, it } from "vitest";

import { aLead } from "../testing/fixtures/aLead";
import { FakeAuditPort } from "../testing/fakes/FakeAuditPort";
import { LeadEvent, LeadStatus } from "../domain/enums";
import { applyTransition } from "./__apply-transition";
import { InMemoryTransitionStore } from "./testing/in-memory-transition-store";
import type { GuardFacts } from "../domain/state-machine/types";

const env = { ...process.env };

afterEach(() => {
  process.env = { ...env };
});

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

describe("applyTransition double-write + rollback", () => {
  it("persists matching Lead.status and latest history toStatus", async () => {
    process.env.LEAD_STATE_MACHINE_ENABLED = "on";
    const store = new InMemoryTransitionStore();
    const lead = aLead({ status: LeadStatus.NEW });
    store.seed(lead);
    const audit = new FakeAuditPort();
    const { result } = await applyTransition(
      { store, audit },
      {
        leadId: lead.id,
        event: LeadEvent.assign,
        actor: { userId: "u1", roles: ["OPS_MANAGER"] },
        payload: { assigneeUserId: "tc_1" },
        facts: facts(),
      },
    );
    expect(result.nextStatus).toBe(LeadStatus.ASSIGNED);
    const stored = await store.load(lead.id);
    expect(stored?.status).toBe(LeadStatus.ASSIGNED);
    expect(store.history.at(-1)?.toStatus).toBe(stored?.status);
  });

  it("rolls back when persist throws mid-transition", async () => {
    process.env.LEAD_STATE_MACHINE_ENABLED = "on";
    const store = new InMemoryTransitionStore();
    store.throwAfterWrites = true;
    const lead = aLead({ status: LeadStatus.NEW });
    store.seed(lead);
    await expect(
      applyTransition(
        { store, audit: new FakeAuditPort() },
        {
          leadId: lead.id,
          event: LeadEvent.assign,
          actor: { userId: "u1", roles: ["OPS_MANAGER"] },
          payload: { assigneeUserId: "tc_1" },
          facts: facts(),
        },
      ),
    ).rejects.toThrow("mid-transition failure");
    expect((await store.load(lead.id))?.status).toBe(LeadStatus.NEW);
    expect(store.history.filter((h) => h.leadId === lead.id)).toHaveLength(0);
  });
});
