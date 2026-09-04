import {
  LeadPersonType,
  LeadSource,
  LeadStatus,
  LeadTier,
} from "../../domain/enums";
import { Lead } from "../../domain/entities/Lead";
import { ContactInfo } from "../../domain/value-objects/ContactInfo";
import { Consent } from "../../domain/value-objects/Consent";
import { LeadCode } from "../../domain/value-objects/LeadCode";
import { TierScore } from "../../domain/value-objects/TierScore";

export function aLead(overrides: Partial<{
  id: string;
  code: string;
  status: LeadStatus;
  personType: LeadPersonType;
  assignedTelecallerId: string | null;
}> = {}): Lead {
  return new Lead({
    id: overrides.id ?? "lead_1",
    code: LeadCode.parse(overrides.code ?? "LED-KOL-20260904-0001"),
    personType: overrides.personType ?? LeadPersonType.DONOR,
    donorSubtype: "SEMEN",
    contact: new ContactInfo("Test Lead", "9999999999", "t@example.com", "Kolkata", "WB", "700001", "English"),
    consent: new Consent(false, false, true, "lead-v1.0", "127.0.0.1", "vitest"),
    status: overrides.status ?? LeadStatus.NEW,
    outcome: null,
    isArchived: false,
    archive: null,
    source: LeadSource.WEB_FORM,
    latestScore: new TierScore(40, LeadTier.COLD, "SCORE_WEIGHTS_V1@1", new Date("2026-09-04T00:00:00.000Z")),
    latestScoreId: null,
    ownership: {
      siteId: null,
      assignedTelecallerId: overrides.assignedTelecallerId ?? null,
      activeAssignmentId: null,
    },
    retention: {
      capturedAt: new Date("2026-09-04T00:00:00.000Z"),
      retentionExpiresAt: new Date("2027-09-04T00:00:00.000Z"),
    },
    merge: { mergedIntoLeadId: null },
    conversion: {
      convertedDonorId: null,
      convertedRecipientId: null,
      convertedAt: null,
    },
    duplicate: { duplicateOfLeadId: null },
    version: 1,
  });
}

export function aQualifiedLead(): Lead {
  return aLead({ status: LeadStatus.CONTACTED_QUALIFIED });
}
