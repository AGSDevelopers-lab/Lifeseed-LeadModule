import { describe, expect, it } from "vitest";

import { LeadOutcome } from "../../domain/enums";
import { leadToDomain } from "./lead-mapper";
import type { PrismaLeadRow } from "./lead-mapper";

function row(outcome: string | null): PrismaLeadRow {
  const capturedAt = new Date("2026-09-04T00:00:00.000Z");
  return {
    id: "lead-o",
    leadCode: "LED-KOL-20260904-0002",
    personType: "DONOR",
    donorSubType: "SEMEN",
    source: "WEB_FORM",
    capturedAt,
    fullName: "O",
    phone: "9000000002",
    email: "o@example.com",
    city: "Kolkata",
    state: "WB",
    pincode: "700001",
    preferredLanguage: "English",
    score: 40,
    tier: "COLD",
    status: "ASSIGNED",
    assignedTelecallerId: null,
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
    outcome,
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
  };
}

describe("B17-B Outcome column mapping", () => {
  it("maps WON LOST EXPIRED MERGED and null", () => {
    expect(leadToDomain(row("WON")).props.outcome).toBe(LeadOutcome.WON);
    expect(leadToDomain(row("LOST")).props.outcome).toBe(LeadOutcome.LOST);
    expect(leadToDomain(row("EXPIRED")).props.outcome).toBe(LeadOutcome.EXPIRED);
    expect(leadToDomain(row("MERGED")).props.outcome).toBe(LeadOutcome.MERGED);
    expect(leadToDomain(row(null)).props.outcome).toBeNull();
  });
});
