import { Lead } from "../../domain/entities/Lead";
import {
  LeadOutcome,
  LeadPersonType,
  LeadSource,
  LeadStatus,
  LeadTier,
  type LeadDonorSubType,
} from "../../domain/enums";
import { ArchiveMeta } from "../../domain/value-objects/ArchiveMeta";
import { Consent } from "../../domain/value-objects/Consent";
import { ContactInfo } from "../../domain/value-objects/ContactInfo";
import { LeadCode } from "../../domain/value-objects/LeadCode";
import { TierScore } from "../../domain/value-objects/TierScore";

/** Persistence row plus the two includes used by LeadRepository.byId. */
export type PrismaLeadRow = {
  id: string;
  leadCode: string;
  personType: string;
  donorSubType: string | null;
  source: string;
  capturedAt: Date;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  preferredLanguage: string | null;
  score: number;
  tier: string;
  status: string;
  assignedTelecallerId: string | null;
  convertedDonorId: string | null;
  convertedRecipientId: string | null;
  convertedAt: Date | null;
  consentMarketing: boolean;
  consentScreening: boolean;
  consentDataProcessing: boolean;
  consentVersion: string | null;
  consentIp: string | null;
  consentUserAgent: string | null;
  retentionExpiresAt: Date | null;
  outcome: string | null;
  isArchived: boolean;
  archivedAt: Date | null;
  archivedByUserId: string | null;
  archiveReason: string | null;
  latestScoreId: string | null;
  latestScoreValue: number | null;
  activeAssignmentId: string | null;
  mergedIntoLeadId: string | null;
  duplicateOfLeadId: string | null;
  version: number;
  counsellingBooking?: { counsellorUserId: string } | null;
  assignedTelecaller?: { siteId: string | null } | null;
};

export function leadToDomain(row: PrismaLeadRow): Lead {
  const archive =
    row.isArchived && row.archivedAt
      ? new ArchiveMeta(row.archivedAt, row.archivedByUserId, row.archiveReason)
      : null;
  const scoreValue = row.latestScoreValue ?? row.score;
  const latestScore = new TierScore(
    Math.min(100, Math.max(0, Math.round(scoreValue))),
    row.tier as (typeof LeadTier)[keyof typeof LeadTier],
    row.latestScoreId ?? "legacy",
    row.capturedAt,
  );
  return new Lead({
    id: row.id,
    code: LeadCode.parse(row.leadCode),
    personType: row.personType as (typeof LeadPersonType)[keyof typeof LeadPersonType],
    donorSubtype: (row.donorSubType as LeadDonorSubType | null) ?? null,
    contact: new ContactInfo(
      row.fullName,
      row.phone,
      row.email,
      row.city,
      row.state,
      row.pincode,
      row.preferredLanguage,
    ),
    consent: new Consent(
      row.consentMarketing,
      row.consentScreening,
      row.consentDataProcessing,
      row.consentVersion,
      row.consentIp,
      row.consentUserAgent,
    ),
    status: row.status as (typeof LeadStatus)[keyof typeof LeadStatus],
    outcome: (row.outcome as (typeof LeadOutcome)[keyof typeof LeadOutcome] | null) ?? null,
    isArchived: row.isArchived,
    archive,
    source: row.source as (typeof LeadSource)[keyof typeof LeadSource],
    latestScore,
    latestScoreId: row.latestScoreId,
    ownership: {
      siteId: row.assignedTelecaller?.siteId ?? null,
      assignedTelecallerId: row.assignedTelecallerId,
      activeAssignmentId: row.activeAssignmentId,
    },
    retention: {
      capturedAt: row.capturedAt,
      retentionExpiresAt: row.retentionExpiresAt,
    },
    merge: { mergedIntoLeadId: row.mergedIntoLeadId },
    conversion: {
      convertedDonorId: row.convertedDonorId,
      convertedRecipientId: row.convertedRecipientId,
      convertedAt: row.convertedAt,
    },
    duplicate: { duplicateOfLeadId: row.duplicateOfLeadId },
    version: row.version,
  });
}

export function leadToPrisma(lead: Lead): PrismaLeadRow {
  const p = lead.props;
  const score = p.latestScore?.score ?? 0;
  return {
    id: p.id,
    leadCode: p.code.toString(),
    personType: p.personType,
    donorSubType: p.donorSubtype,
    source: p.source,
    capturedAt: p.retention.capturedAt,
    fullName: p.contact.fullName,
    phone: p.contact.phone,
    email: p.contact.email,
    city: p.contact.city,
    state: p.contact.state,
    pincode: p.contact.pincode,
    preferredLanguage: p.contact.preferredLanguage,
    score,
    tier: p.latestScore?.tier ?? LeadTier.COLD,
    status: p.status,
    assignedTelecallerId: p.ownership.assignedTelecallerId,
    convertedDonorId: p.conversion.convertedDonorId,
    convertedRecipientId: p.conversion.convertedRecipientId,
    convertedAt: p.conversion.convertedAt,
    consentMarketing: p.consent.marketing,
    consentScreening: p.consent.screening,
    consentDataProcessing: p.consent.dataProcessing,
    consentVersion: p.consent.version,
    consentIp: p.consent.ip,
    consentUserAgent: p.consent.userAgent,
    retentionExpiresAt: p.retention.retentionExpiresAt,
    outcome: p.outcome,
    isArchived: p.isArchived,
    archivedAt: p.archive?.archivedAt ?? null,
    archivedByUserId: p.archive?.archivedByUserId ?? null,
    archiveReason: p.archive?.reason ?? null,
    latestScoreId: p.latestScoreId,
    latestScoreValue: p.latestScore?.score ?? null,
    activeAssignmentId: p.ownership.activeAssignmentId,
    mergedIntoLeadId: p.merge.mergedIntoLeadId,
    duplicateOfLeadId: p.duplicate.duplicateOfLeadId,
    version: p.version,
    counsellingBooking: null,
    assignedTelecaller: { siteId: p.ownership.siteId },
  };
}

export const toDomain = leadToDomain;
export const toPrisma = leadToPrisma;
