import {
  DonorPhase,
  DonorStatus,
  DonorType,
  LeadPersonType,
  SiteCode,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import type {
  ConversionPort,
  ConversionResult,
  ConvertDonorInput,
  ConvertRecipientInput,
  EligibilityResult,
} from "../domain/ports/ConversionPort";
import type { DonorConvertExtras, RecipientConvertInput } from "../lead-conversion";

type LeadRow = {
  id: string;
  personType: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  donorSubType: string | null;
  doNotCallFlag: boolean;
  consentDataProcessing: boolean;
  convertedDonorId: string | null;
  convertedRecipientId: string | null;
};

type ConversionDb = {
  lead: { findUnique: (args: { where: { id: string } }) => Promise<LeadRow | null> };
  leadConversion: { findUnique: (args: { where: { leadId: string } }) => Promise<{ id: string } | null> };
  leadDoNotCallList: { findUnique: (args: { where: { phone: string } }) => Promise<{ id: string } | null> };
  counsellingOutcome: {
    findFirst: (args: object) => Promise<{ recommendation: string } | null>;
  };
  donor: {
    findFirst: (args: object) => Promise<{ donorCode: string } | null>;
    create: (args: object) => Promise<{ id: string; donorCode: string }>;
  };
  recipient: {
    findFirst: (args: object) => Promise<{ recipientCode: string } | null>;
    create: (args: object) => Promise<{ id: string; recipientCode: string }>;
  };
  site: { findUnique: (args: { where: { id: string } }) => Promise<{ id: string; code: SiteCode } | null> };
};

function asDb(unitOfWork: unknown | undefined): ConversionDb {
  return (unitOfWork ?? prisma) as ConversionDb;
}

async function nextDonorCode(db: ConversionDb, siteCode: SiteCode): Promise<string> {
  const prefix = `D-${siteCode}-`;
  const latest = await db.donor.findFirst({
    where: { donorCode: { startsWith: prefix } },
    orderBy: { donorCode: "desc" },
    select: { donorCode: true },
  });
  const seq = latest ? Number(latest.donorCode.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(5, "0")}`;
}

async function nextRecipientCode(db: ConversionDb): Promise<string> {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const stub = `R-${ymd}-`;
  const latest = await db.recipient.findFirst({
    where: { recipientCode: { startsWith: stub } },
    orderBy: { recipientCode: "desc" },
  });
  const seq = latest ? Number(latest.recipientCode.slice(stub.length)) + 1 : 1;
  return `${stub}${String(seq).padStart(4, "0")}`;
}

function parseDonorExtras(extras: Record<string, unknown>): DonorConvertExtras | null {
  const dob = extras.dob;
  const gender = extras.gender;
  const siteId = extras.siteId;
  if (typeof dob !== "string" || !dob) return null;
  if (gender !== "M" && gender !== "F" && gender !== "O") return null;
  if (typeof siteId !== "string" || !siteId) return null;
  return {
    dob,
    gender,
    siteId,
    aadhaarHash: typeof extras.aadhaarHash === "string" ? extras.aadhaarHash : undefined,
    maritalStatus: typeof extras.maritalStatus === "string" ? extras.maritalStatus : undefined,
    hasLivingChild: typeof extras.hasLivingChild === "boolean" ? extras.hasLivingChild : undefined,
    panMasked: typeof extras.panMasked === "string" ? extras.panMasked : undefined,
    addressLine: typeof extras.addressLine === "string" ? extras.addressLine : undefined,
    preferredIntakeAt:
      typeof extras.preferredIntakeAt === "string" ? extras.preferredIntakeAt : undefined,
    coordinatorUserId:
      typeof extras.coordinatorUserId === "string" ? extras.coordinatorUserId : undefined,
  };
}

export class HisConversionAdapter implements ConversionPort {
  constructor(private readonly db: ConversionDb = prisma as unknown as ConversionDb) {}

  async isEligibleForDonor(leadId: string): Promise<EligibilityResult> {
    return this.evaluateEligibility(leadId, "DONOR");
  }

  async isEligibleForRecipient(leadId: string): Promise<EligibilityResult> {
    return this.evaluateEligibility(leadId, "RECIPIENT");
  }

  async convertToDonor(input: ConvertDonorInput): Promise<ConversionResult> {
    const db = asDb(input.unitOfWork ?? this.db);
    const extras = parseDonorExtras(input.extras);
    if (!extras) return { ok: false, error: "Donor conversion extras incomplete (dob, gender, siteId)" };

    const eligibility = await this.evaluateEligibility(input.leadId, "DONOR", db);
    if (!eligibility.eligible) {
      return { ok: false, error: eligibility.reasons.join("; ") };
    }

    const lead = await db.lead.findUnique({ where: { id: input.leadId } });
    if (!lead || !lead.fullName || !lead.phone) {
      return { ok: false, error: "Lead missing name/phone" };
    }

    const type = lead.donorSubType === "OOCYTE" ? DonorType.OOCYTE : DonorType.SEMEN;
    // ART Act eligibility (living child, marital status, spouse consent, serology, etc.)
    // is NOT enforced here. Donor Pathway owns the P0_INTAKE → P1_STAGE_1 gate.

    const site = await db.site.findUnique({ where: { id: extras.siteId } });
    if (!site) return { ok: false, error: "Site not found" };

    const aadhaarHash =
      extras.aadhaarHash && extras.aadhaarHash.length === 64 ? extras.aadhaarHash : null;

    const donorCode = await nextDonorCode(db, site.code);
    const donor = await db.donor.create({
      data: {
        donorCode,
        type,
        siteId: extras.siteId,
        fullName: lead.fullName,
        dob: new Date(extras.dob),
        gender: extras.gender,
        aadhaarHash,
        panMasked: extras.panMasked || null,
        phone: lead.phone,
        email: lead.email || null,
        addressLine: extras.addressLine || null,
        city: lead.city || null,
        stateCode: lead.state || null,
        pincode: lead.pincode || null,
        maritalStatus: extras.maritalStatus || null,
        hasLivingChild: extras.hasLivingChild ?? null,
        status: DonorStatus.ELIGIBLE,
        phase: DonorPhase.P0_INTAKE,
        bankPolicyCap: type === DonorType.SEMEN ? 5 : 1,
        sourceLeadId: input.leadId,
      },
    });

    return { ok: true, targetEntityId: donor.id, donorId: donor.id, donorCode: donor.donorCode };
  }

  async convertToRecipient(input: ConvertRecipientInput): Promise<ConversionResult> {
    const db = asDb(input.unitOfWork ?? this.db);
    const clinicId = input.extras.clinicId;
    if (typeof clinicId !== "string" || !clinicId) {
      return { ok: false, error: "clinicId is required" };
    }

    const eligibility = await this.evaluateEligibility(input.leadId, "RECIPIENT", db);
    if (!eligibility.eligible) {
      return { ok: false, error: eligibility.reasons.join("; ") };
    }

    const lead = await db.lead.findUnique({ where: { id: input.leadId } });
    if (!lead || !lead.fullName || !lead.phone || !lead.email) {
      return { ok: false, error: "Recipient lead needs name, phone, email" };
    }

    const recInput = input.extras as RecipientConvertInput & Record<string, unknown>;
    const code = await nextRecipientCode(db);
    const recipient = await db.recipient.create({
      data: {
        recipientCode: code,
        fullName: lead.fullName,
        partnerName: typeof recInput.partnerName === "string" ? recInput.partnerName : null,
        dob: typeof recInput.dob === "string" && recInput.dob ? new Date(recInput.dob) : null,
        phone: lead.phone,
        email: lead.email,
        city: lead.city,
        stateCode: lead.state,
        pincode: lead.pincode,
        clinicId,
        sourceLeadId: input.leadId,
      },
    });

    return {
      ok: true,
      targetEntityId: recipient.id,
      recipientId: recipient.id,
      recipientCode: recipient.recipientCode,
    };
  }

  private async evaluateEligibility(
    leadId: string,
    target: "DONOR" | "RECIPIENT",
    db: ConversionDb = this.db,
  ): Promise<EligibilityResult> {
    const reasons: string[] = [];
    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { eligible: false, reasons: ["Lead not found"] };

    const conversion = await db.leadConversion.findUnique({ where: { leadId } });
    if (conversion || lead.convertedDonorId || lead.convertedRecipientId) {
      reasons.push("Existing conversion");
    }

    if (lead.doNotCallFlag) reasons.push("DNC present");
    if (lead.phone) {
      const dnc = await db.leadDoNotCallList.findUnique({ where: { phone: lead.phone } });
      if (dnc) reasons.push("DNC present");
    }

    if (!lead.fullName) reasons.push("Missing fullName");
    if (!lead.phone) reasons.push("Missing phone");
    if (!lead.consentDataProcessing) reasons.push("Consent not captured");

    if (target === "DONOR") {
      if (lead.personType !== LeadPersonType.DONOR) reasons.push("Lead is not a donor lead");
    } else {
      if (lead.personType !== LeadPersonType.RECIPIENT) reasons.push("Lead is not a recipient lead");
      if (!lead.email) reasons.push("Missing email");
      const outcome = await db.counsellingOutcome.findFirst({
        where: { leadId },
        orderBy: { createdAt: "desc" },
      });
      if (outcome && outcome.recommendation !== "RECOMMEND_REGISTER") {
        reasons.push("Counselling recommendation is not RECOMMEND_REGISTER");
      }
    }

    const unique = [...new Set(reasons)];
    return { eligible: unique.length === 0, reasons: unique };
  }
}

export const hisConversionAdapter = new HisConversionAdapter();
