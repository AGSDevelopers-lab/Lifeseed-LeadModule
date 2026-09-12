import {
  DonorType,
  LeadPersonType,
  LeadStatus,
  SiteCode,
  SlaEntityType,
  type Prisma,
} from "@prisma/client";

import { createDonorIntake } from "@/app/(portals)/admin/donors/actions";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { applyAuthorizedLeadStatus, loadPrismaLeadAfterAccess } from "@/lib/leads/adapters/prisma-lead-repository";
import type { ActorContext } from "@/lib/leads/domain/ports/shared";
import { markCompletedByEntity } from "@/lib/sla/engine";
import { isLeadConversionPortEnabled } from "@/lib/leads/application/feature-flag";

export type DonorConvertExtras = {
  dob: string;
  gender: "M" | "F" | "O";
  siteId: string;
  /** Deferred until P1 screening + STAGE_2 consent (DPDP). */
  aadhaarHash?: string;
  maritalStatus?: string;
  hasLivingChild?: boolean;
  panMasked?: string;
  addressLine?: string;
  /** Preferred date for full intake screening appointment (telecall handoff). */
  preferredIntakeAt?: string;
  /** Bank coordinator user id for handoff (optional). */
  coordinatorUserId?: string;
};

/**
 * Convert qualified DONOR lead → Donor via existing createDonorIntake.
 * Caller must hold donor.create (TELECALLER/OPS granted for conversion path).
 * Aadhaar is optional here — collected later at P1 with STAGE_2 consent.
 */
export async function convertLeadToDonor(
  leadId: string,
  actorId: string,
  extras: DonorConvertExtras,
  options: { skipStatusWrite?: boolean } = {},
  ctx?: ActorContext,
): Promise<{ ok: true; donorId: string } | { ok: false; error: string }> {
  if (isLeadConversionPortEnabled()) {
    const { convertDonor } = await import("@/lib/leads/application/convert");
    const result = await convertDonor(leadId, { userId: actorId, roles: ["OPS_MANAGER"] }, extras);
    if (result.ok && result.donorId) return { ok: true, donorId: result.donorId };
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: false, error: "Conversion failed" };
  }
  console.warn(
    JSON.stringify({
      msg: "lead_conversion_legacy_path_deprecated",
      path: "convertLeadToDonor",
      leadId,
    }),
  );
  return convertLeadToDonorLegacy(leadId, actorId, extras, options, ctx);
}

async function convertLeadToDonorLegacy(
  leadId: string,
  actorId: string,
  extras: DonorConvertExtras,
  options: { skipStatusWrite?: boolean } = {},
  ctx?: ActorContext,
): Promise<{ ok: true; donorId: string } | { ok: false; error: string }> {
  const lead = await loadPrismaLeadAfterAccess(
    leadId,
    ctx ?? { userId: actorId, roles: ["TELECALLER"] },
  );
  if (!lead) return { ok: false, error: "Lead not found" };
  if (lead.personType !== LeadPersonType.DONOR) {
    return { ok: false, error: "Lead is not a donor lead" };
  }
  if (lead.status === LeadStatus.CONVERTED) {
    return { ok: false, error: "Lead already converted" };
  }
  if (
    lead.status !== LeadStatus.CONTACTED_QUALIFIED &&
    lead.status !== LeadStatus.COUNSELLING_ATTENDED
  ) {
    return {
      ok: false,
      error: "Lead must be CONTACTED_QUALIFIED (or counselling attended) to convert",
    };
  }
  if (!lead.fullName || !lead.phone) {
    return { ok: false, error: "Lead missing name/phone" };
  }
  if (lead.doNotCallFlag) {
    return { ok: false, error: "Lead is on Do Not Call" };
  }

  const type =
    lead.donorSubType === "OOCYTE" ? DonorType.OOCYTE : DonorType.SEMEN;

  const aadhaarHash =
    extras.aadhaarHash && extras.aadhaarHash.length === 64
      ? extras.aadhaarHash
      : undefined;

  const result = await createDonorIntake({
    fullName: lead.fullName,
    dob: extras.dob,
    gender: extras.gender,
    type,
    siteId: extras.siteId,
    phone: lead.phone,
    email: lead.email ?? "",
    addressLine: extras.addressLine ?? undefined,
    city: lead.city ?? undefined,
    stateCode: lead.state ?? undefined,
    pincode: lead.pincode ?? undefined,
    maritalStatus: extras.maritalStatus,
    hasLivingChild: extras.hasLivingChild,
    aadhaarHash,
    panMasked: extras.panMasked,
  });

  if (!result.ok || !result.id) {
    return { ok: false, error: result.ok === false ? result.error : "Intake failed" };
  }

  const donorId = result.id;
  await prisma.donor.update({
    where: { id: donorId },
    data: { sourceLeadId: leadId },
  });

  const prevMeta =
    lead.sourceMetadata && typeof lead.sourceMetadata === "object"
      ? (lead.sourceMetadata as Record<string, unknown>)
      : {};

  const compat = {
    convertedDonorId: donorId,
    convertedAt: new Date(),
    convertedByUserId: actorId,
    retentionExpiresAt: null,
    lastActivityAt: new Date(),
    sourceMetadata: {
      ...prevMeta,
      preferredIntakeAt: extras.preferredIntakeAt ?? null,
      coordinatorUserId: extras.coordinatorUserId ?? null,
      aadhaarDeferred: !aadhaarHash,
    } as Prisma.InputJsonValue,
  };
  if (options.skipStatusWrite) {
    await prisma.lead.update({ where: { id: leadId }, data: compat });
  } else {
    await applyAuthorizedLeadStatus(leadId, LeadStatus.CONVERTED, compat);
  }

  await markCompletedByEntity(SlaEntityType.LEAD_RESPONSE, leadId).catch(
    () => undefined,
  );
  await markCompletedByEntity(SlaEntityType.LEAD_QUALIFICATION, leadId).catch(
    () => undefined,
  );

  await audit.log({
    actorUserId: actorId,
    action: "lead.convert.donor",
    entityType: "Lead",
    entityId: leadId,
    donorRelId: donorId,
    afterJson: {
      donorId,
      leadCode: lead.leadCode,
      preferredIntakeAt: extras.preferredIntakeAt ?? null,
      coordinatorUserId: extras.coordinatorUserId ?? null,
      aadhaarDeferred: !aadhaarHash,
    },
  });

  if (!aadhaarHash) {
    await audit.log({
      actorUserId: actorId,
      action: "lead.converted.aadhaar_deferred",
      entityType: "Donor",
      entityId: donorId,
      donorRelId: donorId,
      afterJson: {
        leadId,
        leadCode: lead.leadCode,
        reason: "Aadhaar deferred until P1 screening + STAGE_2 consent (DPDP)",
      },
    });
  }

  return { ok: true, donorId };
}

export type RecipientConvertInput = {
  clinicId: string;
  partnerName?: string;
  dob?: string;
};

/**
 * Convert RECIPIENT lead → Recipient (existing model + sourceLeadId).
 */
export async function convertLeadToRecipient(
  leadId: string,
  actorId: string,
  input: RecipientConvertInput,
  options: { skipStatusWrite?: boolean } = {},
  ctx?: ActorContext,
): Promise<{ ok: true; recipientId: string } | { ok: false; error: string }> {
  if (isLeadConversionPortEnabled()) {
    const { convertRecipient } = await import("@/lib/leads/application/convert");
    const result = await convertRecipient(leadId, { userId: actorId, roles: ["OPS_MANAGER"] }, input);
    if (result.ok && result.recipientId) return { ok: true, recipientId: result.recipientId };
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: false, error: "Conversion failed" };
  }
  console.warn(
    JSON.stringify({
      msg: "lead_conversion_legacy_path_deprecated",
      path: "convertLeadToRecipient",
      leadId,
    }),
  );
  return convertLeadToRecipientLegacy(leadId, actorId, input, options, ctx);
}

async function convertLeadToRecipientLegacy(
  leadId: string,
  actorId: string,
  input: RecipientConvertInput,
  options: { skipStatusWrite?: boolean } = {},
  ctx?: ActorContext,
): Promise<{ ok: true; recipientId: string } | { ok: false; error: string }> {
  const lead = await loadPrismaLeadAfterAccess(
    leadId,
    ctx ?? { userId: actorId, roles: ["TELECALLER"] },
  );
  if (!lead) return { ok: false, error: "Lead not found" };
  if (lead.personType !== LeadPersonType.RECIPIENT) {
    return { ok: false, error: "Lead is not a recipient lead" };
  }
  if (lead.status === LeadStatus.CONVERTED) {
    return { ok: false, error: "Lead already converted" };
  }
  if (
    lead.status !== LeadStatus.CONTACTED_QUALIFIED &&
    lead.status !== LeadStatus.COUNSELLING_ATTENDED
  ) {
    return { ok: false, error: "Lead not qualified for conversion" };
  }
  if (!lead.fullName || !lead.phone || !lead.email) {
    return { ok: false, error: "Recipient lead needs name, phone, email" };
  }

  const code = await nextRecipientCode();
  const recipient = await prisma.recipient.create({
    data: {
      recipientCode: code,
      fullName: lead.fullName,
      partnerName: input.partnerName ?? null,
      dob: input.dob ? new Date(input.dob) : null,
      phone: lead.phone,
      email: lead.email,
      city: lead.city,
      stateCode: lead.state,
      pincode: lead.pincode,
      clinicId: input.clinicId,
      sourceLeadId: leadId,
    },
  });

  const compat = {
    convertedRecipientId: recipient.id,
    convertedAt: new Date(),
    convertedByUserId: actorId,
    retentionExpiresAt: null,
    lastActivityAt: new Date(),
  };
  if (options.skipStatusWrite) {
    await prisma.lead.update({ where: { id: leadId }, data: compat });
  } else {
    await applyAuthorizedLeadStatus(leadId, LeadStatus.CONVERTED, compat);
  }

  await audit.log({
    actorUserId: actorId,
    action: "lead.convert.recipient",
    entityType: "Lead",
    entityId: leadId,
    afterJson: { recipientId: recipient.id, leadCode: lead.leadCode },
  });

  return { ok: true, recipientId: recipient.id };
}

async function nextRecipientCode(): Promise<string> {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const stub = `R-${ymd}-`;
  const latest = await prisma.recipient.findFirst({
    where: { recipientCode: { startsWith: stub } },
    orderBy: { recipientCode: "desc" },
  });
  const seq = latest
    ? Number(latest.recipientCode.slice(stub.length)) + 1
    : 1;
  return `${stub}${String(seq).padStart(4, "0")}`;
}

/** Map city/state hint to SiteCode for intake site picker defaults. */
export function guessSiteCode(city?: string | null, state?: string | null): SiteCode {
  const blob = `${city ?? ""} ${state ?? ""}`.toLowerCase();
  if (blob.includes("hyderabad") || blob.includes("telangana") || blob.includes("tg")) {
    return SiteCode.TG;
  }
  return SiteCode.WB;
}
