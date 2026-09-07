import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/audit", () => ({
  audit: { log: vi.fn() },
  createAuditedPrismaClient: vi.fn(),
}));

import { HisConversionAdapter } from "./his-conversion-adapter";
import { LeadPersonType } from "@prisma/client";

function mockDb(over: Record<string, unknown> = {}) {
  return {
    lead: {
      findUnique: vi.fn(),
    },
    leadConversion: {
      findUnique: vi.fn(async () => null),
    },
    leadDoNotCall: {
      findFirst: vi.fn(async () => null),
    },
    counsellingOutcome: {
      findFirst: vi.fn(async () => null),
    },
    ...over,
  };
}

describe("HisConversionAdapter eligibility", () => {
  it("missing required fields → not eligible with reasons", async () => {
    const db = mockDb();
    vi.mocked(db.lead.findUnique).mockResolvedValue({
      id: "l1",
      personType: LeadPersonType.DONOR,
      fullName: null,
      phone: null,
      email: null,
      doNotCallFlag: false,
      consentDataProcessing: true,
      convertedDonorId: null,
      convertedRecipientId: null,
    } as never);
    const adapter = new HisConversionAdapter(db as never);
    const result = await adapter.isEligibleForDonor("l1");
    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining(["Missing fullName", "Missing phone"]));
  });

  it("DNC present → not eligible", async () => {
    const db = mockDb();
    vi.mocked(db.lead.findUnique).mockResolvedValue({
      id: "l1",
      personType: LeadPersonType.DONOR,
      fullName: "A",
      phone: "9999999999",
      email: "a@b.c",
      doNotCallFlag: true,
      consentDataProcessing: true,
      convertedDonorId: null,
      convertedRecipientId: null,
    } as never);
    const adapter = new HisConversionAdapter(db as never);
    const result = await adapter.isEligibleForDonor("l1");
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("DNC present");
  });

  it("existing conversion → not eligible", async () => {
    const db = mockDb();
    vi.mocked(db.lead.findUnique).mockResolvedValue({
      id: "l1",
      personType: LeadPersonType.DONOR,
      fullName: "A",
      phone: "9999999999",
      email: "a@b.c",
      doNotCallFlag: false,
      consentDataProcessing: true,
      convertedDonorId: "d1",
      convertedRecipientId: null,
    } as never);
    vi.mocked(db.leadConversion.findUnique).mockResolvedValue({ id: "c1" } as never);
    const adapter = new HisConversionAdapter(db as never);
    const result = await adapter.isEligibleForDonor("l1");
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("Existing conversion");
  });

  it("missing data-processing consent → not eligible", async () => {
    const db = mockDb();
    vi.mocked(db.lead.findUnique).mockResolvedValue({
      id: "l1",
      personType: LeadPersonType.DONOR,
      fullName: "A",
      phone: "9999999999",
      email: "a@b.c",
      doNotCallFlag: false,
      consentDataProcessing: false,
      convertedDonorId: null,
      convertedRecipientId: null,
    } as never);
    const adapter = new HisConversionAdapter(db as never);
    const result = await adapter.isEligibleForDonor("l1");
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("Consent not captured");
  });

  // ART Act living-child / marital / spouse-consent checks are intentionally
  // absent: Donor Pathway P0_INTAKE → P1_STAGE_1 is authoritative.
});
