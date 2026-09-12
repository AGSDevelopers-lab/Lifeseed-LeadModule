import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/audit", () => ({
  audit: { log: vi.fn(async () => undefined) },
}));

import { LeadOwnershipDeniedError } from "../domain/errors";
import { PrismaLeadRepository, type LeadReadDb } from "./prisma-lead-repository";
import type { LeadAccessAuditor } from "./prisma-audit";

function prismaRow(overrides: Record<string, unknown> = {}) {
  const capturedAt = new Date("2026-09-04T00:00:00.000Z");
  return {
    id: "lead-b",
    leadCode: "LED-KOL-20260904-0002",
    personType: "DONOR",
    donorSubType: "SEMEN",
    source: "WEB_FORM",
    capturedAt,
    fullName: "B Lead",
    phone: "9000000002",
    email: "b@example.com",
    city: "Kolkata",
    state: "WB",
    pincode: "700001",
    preferredLanguage: "English",
    score: 40,
    tier: "COLD",
    status: "ASSIGNED",
    assignedTelecallerId: "tele-b",
    convertedDonorId: null,
    convertedRecipientId: null,
    convertedAt: null,
    consentMarketing: true,
    consentScreening: false,
    consentDataProcessing: true,
    consentVersion: "lead-v1.0",
    consentIp: null,
    consentUserAgent: null,
    retentionExpiresAt: null,
    outcome: null,
    isArchived: false,
    archivedAt: null,
    archivedByUserId: null,
    archiveReason: null,
    latestScoreId: null,
    latestScoreValue: 40,
    activeAssignmentId: null,
    mergedIntoLeadId: null,
    duplicateOfLeadId: null,
    version: 1,
    counsellingBooking: null,
    assignedTelecaller: { siteId: "site-kol" },
    ...overrides,
  };
}

function makeRepo(row: ReturnType<typeof prismaRow> | null, audit: LeadAccessAuditor) {
  const findMany = vi.fn(async () => (row ? [row as never] : []));
  const db: LeadReadDb = {
    lead: {
      findUnique: vi.fn(async () => row as never),
      findMany,
    },
  };
  return { repo: new PrismaLeadRepository(db, audit), findMany };
}

function fakeAudit(): LeadAccessAuditor & {
  denied: unknown[];
  views: unknown[];
} {
  const denied: unknown[] = [];
  const views: unknown[] = [];
  return {
    denied,
    views,
    async recordDenied(input) {
      denied.push(input);
    },
    async recordView(input) {
      views.push(input);
    },
  };
}

describe("PrismaLeadRepository.byId IDOR", () => {
  it("refuses telecaller-A reading telecaller-B's lead and audits denial", async () => {
    const audit = fakeAudit();
    const { repo } = makeRepo(prismaRow(), audit);
    await expect(
      repo.byId("lead-b", {
        userId: "tele-a",
        roles: ["TELECALLER"],
        siteId: "site-kol",
      }),
    ).rejects.toBeInstanceOf(LeadOwnershipDeniedError);

    expect(audit.denied).toHaveLength(1);
    const row = audit.denied[0] as { denialReason: string; requiredPermission: string };
    expect(row.denialReason).toBe("OWNERSHIP_DENIED");
    expect(row.requiredPermission).toBe("lead.view.own");
  });

  it("returns the lead for the assigned telecaller without a denial row", async () => {
    const audit = fakeAudit();
    const { repo } = makeRepo(prismaRow(), audit);
    const lead = await repo.byId("lead-b", {
      userId: "tele-b",
      roles: ["TELECALLER"],
      siteId: "site-kol",
    });
    expect(lead?.id).toBe("lead-b");
    expect(audit.denied).toHaveLength(0);
  });

  it("returns null when the lead does not exist (no denial audit)", async () => {
    const audit = fakeAudit();
    const { repo } = makeRepo(null, audit);
    await expect(
      repo.byId("missing", {
        userId: "tele-a",
        roles: ["TELECALLER"],
      }),
    ).resolves.toBeNull();
    expect(audit.denied).toHaveLength(0);
  });

  it("list omits other telecallers' leads at the query predicate", async () => {
    const audit = fakeAudit();
    const { repo, findMany } = makeRepo(prismaRow(), audit);
    const page = await repo.list({
      userId: "tele-a",
      roles: ["TELECALLER"],
      siteId: "site-kol",
    });
    expect(page.items).toHaveLength(1);
    const arg = findMany.mock.calls[0][0] as { where: { assignedTelecallerId: string } };
    expect(arg.where.assignedTelecallerId).toBe("tele-a");
  });

  it("refuses BANK_MEDICAL_DIRECTOR case-level read (LADR-25)", async () => {
    const audit = fakeAudit();
    const { repo } = makeRepo(prismaRow(), audit);
    await expect(
      repo.byId("lead-b", {
        userId: "md-1",
        roles: ["BANK_MEDICAL_DIRECTOR"],
        siteId: "site-kol",
      }),
    ).rejects.toMatchObject({
      context: { denialReason: "PERMISSION_DENIED" },
    });
  });
});
