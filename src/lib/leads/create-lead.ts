import {
  CrmEntityType,
  LeadPersonType,
  LeadSource,
  type LeadDonorSubType,
  type Prisma,
} from "@prisma/client";

import { audit } from "@/lib/audit";
import { enqueue } from "@/lib/crm/sync-queue";
import { prisma } from "@/lib/db";
import {
  scheduleLeadSlaForTier,
} from "@/lib/leads/lead-assignment";
import { allocateLeadCode } from "@/lib/leads/adapters/prisma-lead-code-generator";
import { scoreLeadWithConfig } from "@/lib/leads/lead-scoring";
import { isOnDoNotCallList } from "@/lib/leads/application/dnc";

export type CreateLeadInput = {
  personType: LeadPersonType;
  donorSubType?: LeadDonorSubType | null;
  source: LeadSource;
  sourceMetadata?: Record<string, unknown>;
  fullName: string;
  phone: string;
  phoneCountryCode?: string;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  ageGroup?: string | null;
  preferredLanguage?: string | null;
  consentMarketing: boolean;
  consentScreening: boolean;
  consentDataProcessing: boolean;
  consentVersion: string;
  consentIp?: string | null;
  consentUserAgent?: string | null;
  assignToUserId?: string | null;
  actorId?: string | null;
};

export { isOnDoNotCallList };

/** Raw intake persist (T-01 row). Status omitted — Prisma default NEW. */
export async function persistNewLead(input: CreateLeadInput) {
  if (!input.consentDataProcessing) {
    throw new Error("Data processing consent is required (DPDP)");
  }
  if (await isOnDoNotCallList(input.phone)) {
    throw new Error("Phone is on Do Not Call list");
  }

  const capturedAt = new Date();
  const leadCode = await allocateLeadCode(prisma, input.city, capturedAt);

  const scored = await scoreLeadWithConfig({
    personType: input.personType,
    donorSubType: input.donorSubType,
    source: input.source,
    ageGroup: input.ageGroup,
    city: input.city,
    state: input.state,
    preferredLanguage: input.preferredLanguage,
    email: input.email,
    phone: input.phone,
    fullName: input.fullName,
    pincode: input.pincode,
  });

  const retentionExpiresAt = new Date(capturedAt);
  retentionExpiresAt.setUTCFullYear(retentionExpiresAt.getUTCFullYear() + 1);

  const lead = await prisma.lead.create({
    data: {
      leadCode,
      personType: input.personType,
      donorSubType: input.donorSubType ?? null,
      source: input.source,
      sourceMetadata: (input.sourceMetadata ?? {}) as Prisma.InputJsonValue,
      capturedAt,
      fullName: input.fullName,
      phone: input.phone,
      phoneCountryCode: input.phoneCountryCode ?? "+91",
      email: input.email ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      pincode: input.pincode ?? null,
      ageGroup: input.ageGroup ?? null,
      preferredLanguage: input.preferredLanguage ?? null,
      score: scored.score,
      scoreBreakdown: scored.breakdown as Prisma.InputJsonValue,
      tier: scored.tier,
      consentMarketing: input.consentMarketing,
      consentScreening: input.consentScreening,
      consentDataProcessing: input.consentDataProcessing,
      consentVersion: input.consentVersion,
      consentIp: input.consentIp ?? null,
      consentUserAgent: input.consentUserAgent ?? null,
      retentionExpiresAt,
      lastActivityAt: capturedAt,
    },
  });

  await scheduleLeadSlaForTier(lead.id, scored.tier, capturedAt);
  await enqueue(CrmEntityType.LEAD, lead.id, undefined, {
    leadCode,
    source: input.source,
    tier: scored.tier,
  });

  await audit.log({
    actorUserId: input.actorId ?? null,
    action: "lead.create",
    entityType: "Lead",
    entityId: lead.id,
    afterJson: {
      leadCode,
      tier: scored.tier,
      score: scored.score,
      source: input.source,
    },
  });

  const { isLeadDuplicateEnabled } = await import("@/lib/leads/application/feature-flag");
  if (isLeadDuplicateEnabled()) {
    const { detectAndCreateDuplicateCases } = await import("@/lib/leads/application/duplicate");
    await detectAndCreateDuplicateCases({
      id: lead.id,
      fullName: lead.fullName,
      phone: lead.phone,
      email: lead.email,
    });
  }

  return lead;
}

export async function createLeadFromIntake(input: CreateLeadInput) {
  const { intakeLead } = await import("@/lib/leads/application/intake");
  return intakeLead(input);
}
