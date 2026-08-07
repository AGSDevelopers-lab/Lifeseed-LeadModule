"use server";

import {
  DonorPhase,
  DonorStatus,
  DonorType,
  RejectionCode,
  SiteCode,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { advancePhase, ICMR_SEROLOGY_TESTS } from "@/lib/donor-phase";
import { sha256HexNode } from "@/lib/pii";
import { requirePermission } from "@/lib/rbac";

const intakeSchema = z.object({
  fullName: z.string().min(2),
  dob: z.string().min(1),
  gender: z.enum(["M", "F", "O"]),
  type: z.nativeEnum(DonorType),
  siteId: z.string().min(1),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional().or(z.literal("")),
  addressLine: z.string().optional(),
  city: z.string().optional(),
  stateCode: z.string().optional(),
  pincode: z.string().optional(),
  maritalStatus: z.string().optional(),
  hasLivingChild: z.boolean().optional(),
  aadhaarHash: z.string().length(64),
  panMasked: z.string().optional(),
  height: z.number().int().positive().optional(),
  weight: z.number().int().positive().optional(),
  bmi: z.number().positive().optional(),
});

async function nextDonorCode(siteCode: SiteCode): Promise<string> {
  const prefix = `D-${siteCode}-`;
  const latest = await prisma.donor.findFirst({
    where: { donorCode: { startsWith: prefix } },
    orderBy: { donorCode: "desc" },
    select: { donorCode: true },
  });
  const seq = latest
    ? Number(latest.donorCode.slice(prefix.length)) + 1
    : 1;
  return `${prefix}${String(seq).padStart(5, "0")}`;
}

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function catchPerm(err: unknown): ActionResult {
  if (err instanceof Response) {
    return { ok: false, error: err.status === 401 ? "Unauthorized" : "Forbidden" };
  }
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: "Unexpected error" };
}

export async function createDonorIntake(
  input: z.infer<typeof intakeSchema>,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("donor.create");
    const parsed = intakeSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Validation failed" };
    }
    const data = parsed.data;

    if (data.type === DonorType.OOCYTE && data.hasLivingChild !== true) {
      return {
        ok: false,
        error: "Oocyte donors must have at least one living child (ART Act).",
      };
    }

    const site = await prisma.site.findUnique({ where: { id: data.siteId } });
    if (!site) return { ok: false, error: "Site not found" };

    const donorCode = await nextDonorCode(site.code);

    const donor = await prisma.donor.create({
      data: {
        donorCode,
        type: data.type,
        siteId: data.siteId,
        fullName: data.fullName,
        dob: new Date(data.dob),
        gender: data.gender,
        aadhaarHash: data.aadhaarHash,
        panMasked: data.panMasked || null,
        phone: data.phone,
        email: data.email || null,
        addressLine: data.addressLine || null,
        city: data.city || null,
        stateCode: data.stateCode || null,
        pincode: data.pincode || null,
        maritalStatus: data.maritalStatus || null,
        hasLivingChild: data.hasLivingChild ?? null,
        height: data.height ?? null,
        weight: data.weight ?? null,
        bmi: data.bmi ?? null,
        status: DonorStatus.ELIGIBLE,
        phase: DonorPhase.P0_INTAKE,
        bankPolicyCap: data.type === DonorType.SEMEN ? 5 : 1,
      },
    });

    await audit.log({
      actorUserId: session.userId,
      action: "donor.intake",
      entityType: "Donor",
      entityId: donor.id,
      donorRelId: donor.id,
      afterJson: {
        donorCode: donor.donorCode,
        type: donor.type,
        phase: donor.phase,
        status: donor.status,
      },
    });

    revalidatePath("/admin/donors");
    return { ok: true, id: donor.id };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function captureStage2Consent(input: {
  donorId: string;
  consentText: string;
  typedName: string;
  agreed: boolean;
  signedIp: string | null;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("donor.consent.capture");
    if (!input.agreed) return { ok: false, error: "Consent agreement is required" };
    if (input.typedName.trim().length < 2) {
      return { ok: false, error: "Typed full name is required" };
    }

    const donor = await prisma.donor.findUnique({ where: { id: input.donorId } });
    if (!donor) return { ok: false, error: "Donor not found" };

    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const signedIp =
      input.signedIp ||
      forwarded?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      null;

    const contentHash = sha256HexNode(input.consentText);
    const consent = await prisma.donorConsent.create({
      data: {
        donorId: input.donorId,
        consentType: "STAGE_2",
        version: "v1.0",
        contentHash,
        signedAt: new Date(),
        signedIp,
        witnesses: [],
      },
    });

    await audit.log({
      actorUserId: session.userId,
      action: "CREATE",
      entityType: "DonorConsent",
      entityId: consent.id,
      donorRelId: input.donorId,
      afterJson: {
        consentType: "STAGE_2",
        version: "v1.0",
        contentHash,
        typedName: input.typedName,
      },
    });

    if (donor.phase === DonorPhase.P0_INTAKE) {
      await advancePhase(input.donorId, DonorPhase.P1_SCREENING, {
        actorUserId: session.userId,
        reason: "STAGE_2 consent captured",
      });
    }

    revalidatePath(`/admin/donors/${input.donorId}`);
    return { ok: true, id: consent.id };
  } catch (err) {
    return catchPerm(err);
  }
}

const serologySchema = z.object({
  donorId: z.string().min(1),
  results: z.record(z.string(), z.enum(["NEG", "POS"])),
});

export async function submitSerologyScreening(
  input: z.infer<typeof serologySchema>,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("donor.screening.enter");
    const parsed = serologySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };

    const required = ICMR_SEROLOGY_TESTS.map((t) => t.code);
    for (const code of required) {
      if (!parsed.data.results[code]) {
        return { ok: false, error: `Missing result for ${code}` };
      }
    }

    const donor = await prisma.donor.findUnique({
      where: { id: parsed.data.donorId },
    });
    if (!donor) return { ok: false, error: "Donor not found" };

    for (const code of required) {
      await prisma.labTest.create({
        data: {
          donorId: donor.id,
          testCode: code,
          requisitionSource: "AUTO_MANDATORY",
          requisitionedBy: session.userId,
          result: parsed.data.results[code],
          performedAt: new Date(),
        },
      });
    }

    const anyPositive = required.some(
      (code) => parsed.data.results[code] === "POS",
    );

    if (anyPositive) {
      await prisma.donor.update({
        where: { id: donor.id },
        data: {
          status: DonorStatus.REJECTED,
          phase: DonorPhase.P4_OUTCOME,
          rejectionCode: RejectionCode.SEROLOGY_POSITIVE,
          outcomeNotes: "ICMR mandatory serology panel returned a positive result",
        },
      });
      await audit.log({
        actorUserId: session.userId,
        action: "donor.rejected",
        entityType: "Donor",
        entityId: donor.id,
        donorRelId: donor.id,
        afterJson: {
          rejectionCode: RejectionCode.SEROLOGY_POSITIVE,
          results: parsed.data.results,
        },
      });
    } else {
      if (donor.phase === DonorPhase.P0_INTAKE) {
        await advancePhase(donor.id, DonorPhase.P1_SCREENING, {
          actorUserId: session.userId,
          reason: "Serology entered from intake",
        });
      }
      await advancePhase(donor.id, DonorPhase.P2_ACTIVE, {
        actorUserId: session.userId,
        reason: "ICMR serology panel all NEG — Donor Passport issued",
        setStatus: DonorStatus.ACTIVE,
        setPassport: true,
      });
    }

    revalidatePath(`/admin/donors/${donor.id}`);
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}

const deferSchema = z.object({
  donorId: z.string().min(1),
  rejectionCode: z.nativeEnum(RejectionCode),
  notes: z.string().optional(),
  daysToReview: z.number().int().positive().max(365),
});

export async function deferDonor(
  input: z.infer<typeof deferSchema>,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("donor.defer");
    const parsed = deferSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };

    const until = new Date();
    until.setUTCDate(until.getUTCDate() + parsed.data.daysToReview);

    const updated = await prisma.donor.update({
      where: { id: parsed.data.donorId },
      data: {
        status: DonorStatus.DEFERRED,
        rejectionCode: parsed.data.rejectionCode,
        deferredUntil: until,
        outcomeNotes: parsed.data.notes || null,
      },
    });

    await audit.log({
      actorUserId: session.userId,
      action: "donor.deferred",
      entityType: "Donor",
      entityId: updated.id,
      donorRelId: updated.id,
      afterJson: {
        rejectionCode: parsed.data.rejectionCode,
        deferredUntil: until.toISOString(),
        notes: parsed.data.notes ?? null,
      },
    });

    revalidatePath(`/admin/donors/${updated.id}`);
    revalidatePath("/admin/donors");
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}

const rejectSchema = z.object({
  donorId: z.string().min(1),
  rejectionCode: z.nativeEnum(RejectionCode),
  notes: z.string().optional(),
});

export async function rejectDonor(
  input: z.infer<typeof rejectSchema>,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("donor.reject");
    const parsed = rejectSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };

    const updated = await prisma.donor.update({
      where: { id: parsed.data.donorId },
      data: {
        status: DonorStatus.REJECTED,
        phase: DonorPhase.P4_OUTCOME,
        rejectionCode: parsed.data.rejectionCode,
        outcomeNotes: parsed.data.notes || null,
        deferredUntil: null,
      },
    });

    await audit.log({
      actorUserId: session.userId,
      action: "donor.rejected",
      entityType: "Donor",
      entityId: updated.id,
      donorRelId: updated.id,
      afterJson: {
        rejectionCode: parsed.data.rejectionCode,
        notes: parsed.data.notes ?? null,
      },
    });

    revalidatePath(`/admin/donors/${updated.id}`);
    revalidatePath("/admin/donors");
    return { ok: true };
  } catch (err) {
    return catchPerm(err);
  }
}

export async function redirectToDonor(id: string) {
  redirect(`/admin/donors/${id}`);
}
