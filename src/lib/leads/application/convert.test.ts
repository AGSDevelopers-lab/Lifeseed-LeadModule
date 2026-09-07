import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { $transaction: vi.fn(), leadConversion: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/audit", () => ({
  audit: { log: vi.fn(async () => undefined) },
  createAuditedPrismaClient: vi.fn(),
}));

import { aLead } from "../testing/fixtures/aLead";
import { FakeAuditPort } from "../testing/fakes/FakeAuditPort";
import { FakeConversionPort } from "../testing/fakes/FakeConversionPort";
import { FakeSlaPort } from "../testing/fakes/FakeSlaPort";
import { LeadEventType, LeadPersonType, LeadStatus } from "../domain/enums";
import { convertDonor, convertRecipient, type ConvertDeps } from "./convert";
import { InMemoryTransitionStore } from "./testing/in-memory-transition-store";

const extras = { dob: "1990-01-01", gender: "M" as const, siteId: "site_1" };

function makeDeps(over: Partial<ConvertDeps> = {}): {
  deps: ConvertDeps;
  store: InMemoryTransitionStore;
  conversion: FakeConversionPort;
  sla: FakeSlaPort;
} {
  const store = new InMemoryTransitionStore();
  const conversion = new FakeConversionPort();
  const sla = new FakeSlaPort();
  const deps: ConvertDeps = {
    conversion,
    store,
    sla,
    audit: new FakeAuditPort(),
    flagEnabled: true,
    conversionExists: async (leadId) => store.conversions.some((c) => c.leadId === leadId),
    persistWithClient: async (_uow, input) => store.persistBundle(input),
    runInTransaction: async (fn) => {
      const snapDonors = [...conversion.createdDonorIds];
      const snapRecipients = [...conversion.createdRecipientIds];
      try {
        return await fn({});
      } catch (err) {
        conversion.createdDonorIds = snapDonors;
        conversion.createdRecipientIds = snapRecipients;
        throw err;
      }
    },
    ...over,
  };
  return { deps, store, conversion, sla };
}

describe("B07 ConversionPort convertDonor", () => {
  it("happy path: CONVERTED + LeadConversion + donor + LeadConverted outbox", async () => {
    const { deps, store, conversion, sla } = makeDeps();
    const lead = aLead({ status: LeadStatus.CONTACTED_QUALIFIED, personType: LeadPersonType.DONOR });
    store.seed(lead);
    const result = await convertDonor(lead.id, { userId: "u1", roles: ["OPS_MANAGER"] }, extras, deps);
    expect(result).toMatchObject({ ok: true, donorId: `donor-${lead.id}`, donorCode: "D-WB-00001" });
    const stored = await store.load(lead.id);
    expect(stored?.status).toBe(LeadStatus.CONVERTED);
    expect(store.conversions).toHaveLength(1);
    expect(store.conversions[0]?.targetEntityId).toBe(`donor-${lead.id}`);
    expect(conversion.createdDonorIds).toEqual([`donor-${lead.id}`]);
    expect(store.outbox.some((o) => o.eventType === LeadEventType.LeadConverted)).toBe(true);
    expect(sla.completed.some((c) => c.entityType === "LEAD_QUALIFICATION")).toBe(true);
  });

  it("double convert returns DUPLICATE_CONVERSION and does not create a second donor", async () => {
    const { deps, store, conversion } = makeDeps();
    const lead = aLead({ status: LeadStatus.CONTACTED_QUALIFIED });
    store.seed(lead);
    const first = await convertDonor(lead.id, { userId: "u1", roles: ["OPS_MANAGER"] }, extras, deps);
    expect(first.ok).toBe(true);
    store.seed((await store.load(lead.id))!);
    const second = await convertDonor(lead.id, { userId: "u1", roles: ["OPS_MANAGER"] }, extras, deps);
    expect(second).toMatchObject({ ok: false, code: "DUPLICATE_CONVERSION" });
    expect(conversion.createdDonorIds).toHaveLength(1);
  });

  it("downstream throw rolls back LeadConversion and donor", async () => {
    const { deps, store, conversion } = makeDeps();
    conversion.throwOnConvert = true;
    const lead = aLead({ status: LeadStatus.CONTACTED_QUALIFIED });
    store.seed(lead);
    await expect(
      convertDonor(lead.id, { userId: "u1", roles: ["OPS_MANAGER"] }, extras, deps),
    ).rejects.toThrow("downstream conversion failed");
    expect(store.conversions).toHaveLength(0);
    expect(conversion.createdDonorIds).toHaveLength(0);
    expect((await store.load(lead.id))?.status).toBe(LeadStatus.CONTACTED_QUALIFIED);
  });

  it("persist failure after donor create rolls back both", async () => {
    const { deps, store, conversion } = makeDeps();
    store.throwAfterWrites = true;
    const lead = aLead({ status: LeadStatus.CONTACTED_QUALIFIED });
    store.seed(lead);
    await expect(
      convertDonor(lead.id, { userId: "u1", roles: ["OPS_MANAGER"] }, extras, deps),
    ).rejects.toThrow("mid-transition failure");
    expect(store.conversions).toHaveLength(0);
    expect(conversion.createdDonorIds).toHaveLength(0);
  });
});

describe("B07 ConversionPort convertRecipient", () => {
  it("happy path: CONVERTED + conversion row + recipient integration point", async () => {
    const { deps, store, conversion } = makeDeps();
    const lead = aLead({
      status: LeadStatus.COUNSELLING_ATTENDED,
      personType: LeadPersonType.RECIPIENT,
    });
    store.seed(lead);
    const result = await convertRecipient(
      lead.id,
      { userId: "u1", roles: ["OPS_MANAGER"] },
      { clinicId: "clinic_1" },
      deps,
    );
    expect(result).toMatchObject({
      ok: true,
      recipientId: `recipient-${lead.id}`,
      recipientCode: "R-20260907-0001",
    });
    expect((await store.load(lead.id))?.status).toBe(LeadStatus.CONVERTED);
    expect(store.conversions[0]?.target).toBe("RECIPIENT");
    expect(conversion.createdRecipientIds).toHaveLength(1);
    expect(store.outbox.some((o) => o.eventType === LeadEventType.LeadConverted)).toBe(true);
  });
});
