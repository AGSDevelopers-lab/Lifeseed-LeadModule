"use server";

import {
  CallDispositionType,
  CounsellingBookingStatus,
  CounsellingMode,
  DncSource,
  LeadStatus,
  LeadTier,
  SlaEntityType,
  UserRole,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { applyAuthorizedLeadStatus, assertLeadReadable } from "@/lib/leads/adapters/prisma-lead-repository";
import { LeadOwnershipDeniedError } from "@/lib/leads/domain/errors";
import {
  getLeadStateMachineMode,
  stateMachinePersistsSideEffects,
} from "@/lib/leads/application/feature-flag";
import {
  convertLeadToDonor,
  convertLeadToRecipient,
} from "@/lib/leads/lead-conversion";
import { assignLead } from "@/lib/leads/lead-assignment";
import { requirePermission } from "@/lib/rbac";
import { scheduleSla } from "@/lib/sla/engine";
import { SLA_DEFINITIONS } from "@/lib/sla/definitions";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; code?: string };

function catchErr(err: unknown): ActionResult {
  if (err instanceof LeadOwnershipDeniedError) {
    return { ok: false, error: "Lead not found" };
  }
  if (err && typeof err === "object" && "code" in err && "message" in err) {
    const code = String((err as { code: unknown }).code);
    if (code.startsWith("LEAD_")) {
      return { ok: false, error: String((err as { message: unknown }).message), code };
    }
  }
  if (err instanceof Response) {
    return { ok: false, error: err.status === 401 ? "Unauthorized" : "Forbidden" };
  }
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: "Unexpected error" };
}

async function requireReadableLead(leadId: string) {
  const actor = await resolveLeadActor();
  if (!actor) {
    throw new LeadOwnershipDeniedError("Authentication required", {
      leadId,
      denialReason: "AUTHENTICATION_REQUIRED",
    });
  }
  await assertLeadReadable(leadId, actor);
  return actor;
}

const dispositionSchema = z.object({
  leadId: z.string(),
  disposition: z.nativeEnum(CallDispositionType),
  notes: z.string().optional(),
  followupAt: z.string().optional(),
  callStartedAt: z.string(),
  callEndedAt: z.string().optional(),
});

export async function saveDisposition(
  input: z.infer<typeof dispositionSchema>,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("telecaller.disposition");
    const parsed = dispositionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };
    const d = parsed.data;
    const actor = await requireReadableLead(d.leadId);

    const started = new Date(d.callStartedAt);
    const ended = d.callEndedAt ? new Date(d.callEndedAt) : new Date();
    const durationSeconds = Math.max(
      0,
      Math.round((ended.getTime() - started.getTime()) / 1000),
    );

    const row = await prisma.callDisposition.create({
      data: {
        leadId: d.leadId,
        telecallerId: session.userId,
        callStartedAt: started,
        callEndedAt: ended,
        durationSeconds,
        disposition: d.disposition,
        notes: d.notes ?? null,
        followupAt: d.followupAt ? new Date(d.followupAt) : null,
      },
    });

    const statusMap: Partial<Record<CallDispositionType, LeadStatus>> = {
      CONTACTED_QUALIFIED: LeadStatus.CONTACTED_QUALIFIED,
      CONTACTED_NOT_INTERESTED: LeadStatus.CONTACTED_NOT_INTERESTED,
      CONTACTED_CALLBACK_REQUESTED: LeadStatus.CONTACTED_CALLBACK_REQUESTED,
      NOT_REACHABLE: LeadStatus.NOT_REACHABLE,
      WRONG_NUMBER: LeadStatus.WRONG_NUMBER,
      DO_NOT_CALL: LeadStatus.DO_NOT_CALL,
      LOST: LeadStatus.LOST,
    };

    const eventMap: Partial<
      Record<
        CallDispositionType,
        | "disposition_qualified"
        | "disposition_not_interested"
        | "disposition_callback"
        | "disposition_not_reachable"
        | "disposition_wrong_number"
        | "disposition_do_not_call"
      >
    > = {
      CONTACTED_QUALIFIED: "disposition_qualified",
      CONTACTED_NOT_INTERESTED: "disposition_not_interested",
      CONTACTED_CALLBACK_REQUESTED: "disposition_callback",
      NOT_REACHABLE: "disposition_not_reachable",
      WRONG_NUMBER: "disposition_wrong_number",
      DO_NOT_CALL: "disposition_do_not_call",
    };

    if (stateMachinePersistsSideEffects(getLeadStateMachineMode()) && eventMap[d.disposition]) {
      const { qualifyLead } = await import("@/lib/leads/application/qualify");
      await qualifyLead(d.leadId, actor, eventMap[d.disposition]!, {
        notes: d.notes,
        dueAt: d.followupAt ? new Date(d.followupAt) : null,
        callStartedAt: started,
        callEndedAt: ended,
        reason: d.notes ?? d.disposition,
      });
    } else {
      await applyAuthorizedLeadStatus(d.leadId, statusMap[d.disposition] ?? LeadStatus.ASSIGNED, {
        doNotCallFlag: d.disposition === CallDispositionType.DO_NOT_CALL,
        lastActivityAt: new Date(),
        lostReason:
          d.disposition === CallDispositionType.LOST ? d.notes ?? "Lost" : undefined,
      });
    }

    if (d.disposition === CallDispositionType.DO_NOT_CALL) {
      const lead = await prisma.lead.findUnique({ where: { id: d.leadId } });
      if (lead?.phone) {
        await prisma.leadDoNotCallList.upsert({
          where: { phone: lead.phone },
          create: {
            phone: lead.phone,
            email: lead.email,
            reason: d.notes ?? "Disposition DO_NOT_CALL",
            addedByUserId: session.userId,
            source: DncSource.OPS_ADD,
          },
          update: { reason: d.notes ?? "Disposition DO_NOT_CALL" },
        });
      }
    }

    await audit.log({
      actorUserId: session.userId,
      action: "lead.disposition",
      entityType: "CallDisposition",
      entityId: row.id,
      afterJson: { leadId: d.leadId, disposition: d.disposition },
    });

    revalidatePath(`/telecaller/leads/${d.leadId}`);
    revalidatePath("/telecaller/queue");
    return { ok: true, id: row.id };
  } catch (e) {
    return catchErr(e);
  }
}

const bookSchema = z.object({
  leadId: z.string(),
  counsellorUserId: z.string(),
  scheduledAt: z.string(),
  mode: z.nativeEnum(CounsellingMode),
  meetingUrl: z.string().optional(),
  meetingLocation: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
});

export async function bookCounselling(
  input: z.infer<typeof bookSchema>,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("counselling.book");
    const parsed = bookSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Validation failed" };
    const d = parsed.data;
    const actor = await requireReadableLead(d.leadId);
    const duration =
      d.durationMinutes ??
      Number(process.env.COUNSELLING_DEFAULT_DURATION_MIN ?? "30");

    if (stateMachinePersistsSideEffects(getLeadStateMachineMode())) {
      await (await import("@/lib/leads/application/counselling")).bookCounsellingSession(
        d.leadId,
        actor,
        {
          counsellorUserId: d.counsellorUserId,
          scheduledAt: new Date(d.scheduledAt),
          mode: d.mode,
          meetingUrl: d.meetingUrl ?? null,
          meetingLocation: d.meetingLocation ?? null,
          durationMinutes: duration,
        },
      );
      revalidatePath(`/telecaller/leads/${d.leadId}`);
      return { ok: true };
    }

    const booking = await prisma.counsellingBooking.upsert({
      where: { leadId: d.leadId },
      create: {
        leadId: d.leadId,
        counsellorUserId: d.counsellorUserId,
        scheduledAt: new Date(d.scheduledAt),
        mode: d.mode,
        meetingUrl: d.meetingUrl ?? null,
        meetingLocation: d.meetingLocation ?? null,
        durationMinutes: duration,
        status: CounsellingBookingStatus.BOOKED,
      },
      update: {
        counsellorUserId: d.counsellorUserId,
        scheduledAt: new Date(d.scheduledAt),
        mode: d.mode,
        meetingUrl: d.meetingUrl ?? null,
        meetingLocation: d.meetingLocation ?? null,
        durationMinutes: duration,
        status: CounsellingBookingStatus.BOOKED,
        cancelledAt: null,
        cancelledReason: null,
      },
    });

    await applyAuthorizedLeadStatus(d.leadId, LeadStatus.COUNSELLING_BOOKED, {
      lastActivityAt: new Date(),
    });

    const scheduled = new Date(d.scheduledAt);
    const rem24 = new Date(scheduled.getTime() - 24 * 3600_000);
    const rem2 = new Date(scheduled.getTime() - 2 * 3600_000);
    if (rem24 > new Date()) {
      await scheduleSla(
        booking.id,
        SlaEntityType.COUNSELLING_REMINDER,
        "counselling_reminder_24h",
        rem24,
        SLA_DEFINITIONS.counselling_reminder_24h,
      ).catch(() => undefined);
    }
    if (rem2 > new Date()) {
      await scheduleSla(
        booking.id,
        SlaEntityType.COUNSELLING_REMINDER,
        "counselling_reminder_2h",
        rem2,
        SLA_DEFINITIONS.counselling_reminder_2h,
      ).catch(() => undefined);
    }

    await audit.log({
      actorUserId: session.userId,
      action: "counselling.book",
      entityType: "CounsellingBooking",
      entityId: booking.id,
      afterJson: { leadId: d.leadId, scheduledAt: d.scheduledAt },
    });

    revalidatePath(`/telecaller/leads/${d.leadId}`);
    return { ok: true, id: booking.id };
  } catch (e) {
    return catchErr(e);
  }
}

export async function markCounsellingSession(
  bookingId: string,
  status: "ATTENDED" | "NO_SHOW",
  notes?: string,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("counsellor.mark_attended");
    const booking = await prisma.counsellingBooking.update({
      where: { id: bookingId },
      data: {
        status:
          status === "ATTENDED"
            ? CounsellingBookingStatus.ATTENDED
            : CounsellingBookingStatus.NO_SHOW,
        attendedAt: status === "ATTENDED" ? new Date() : null,
        followupNotes: notes ?? undefined,
      },
    });
    await applyAuthorizedLeadStatus(
      booking.leadId,
      status === "ATTENDED" ? LeadStatus.COUNSELLING_ATTENDED : LeadStatus.COUNSELLING_NO_SHOW,
      { lastActivityAt: new Date() },
    );
    await audit.log({
      actorUserId: session.userId,
      action: "counsellor.mark",
      entityType: "CounsellingBooking",
      entityId: bookingId,
      afterJson: { status },
    });
    revalidatePath(`/counsellor/sessions/${bookingId}`);
    return { ok: true };
  } catch (e) {
    return catchErr(e);
  }
}

export async function convertDonorAction(
  leadId: string,
  extras: {
    dob: string;
    gender: "M" | "F" | "O";
    siteId: string;
    aadhaarHash?: string;
    hasLivingChild?: boolean;
    maritalStatus?: string;
    preferredIntakeAt?: string;
    coordinatorUserId?: string;
  },
): Promise<ActionResult> {
  try {
    const session = await requirePermission("lead.convert");
    await requirePermission("donor.create");
    const actor = await requireReadableLead(leadId);
    if (stateMachinePersistsSideEffects(getLeadStateMachineMode())) {
      const result = await (await import("@/lib/leads/application/convert")).convertDonor(
        leadId,
        actor,
        extras,
      );
      if (!result.ok) return result;
      revalidatePath(`/telecaller/leads/${leadId}`);
      revalidatePath("/admin/donors");
      return { ok: true, id: result.donorId };
    }
    const result = await convertLeadToDonor(leadId, session.userId, extras);
    if (!result.ok) return result;
    revalidatePath(`/telecaller/leads/${leadId}`);
    revalidatePath("/admin/donors");
    return { ok: true, id: result.donorId };
  } catch (e) {
    return catchErr(e);
  }
}

export async function convertRecipientAction(
  leadId: string,
  clinicId: string,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("lead.convert");
    await requireReadableLead(leadId);
    const result = await convertLeadToRecipient(leadId, session.userId, {
      clinicId,
    });
    if (!result.ok) return result;
    revalidatePath(`/telecaller/leads/${leadId}`);
    return { ok: true, id: result.recipientId };
  } catch (e) {
    return catchErr(e);
  }
}

export async function addToDnc(input: {
  phone: string;
  email?: string;
  reason: string;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("dnc.add");
    const row = await prisma.leadDoNotCallList.upsert({
      where: { phone: input.phone },
      create: {
        phone: input.phone,
        email: input.email ?? null,
        reason: input.reason,
        addedByUserId: session.userId,
        source: DncSource.OPS_ADD,
      },
      update: {
        reason: input.reason,
        email: input.email ?? undefined,
      },
    });
    await prisma.lead.updateMany({
      where: { phone: input.phone },
      data: { doNotCallFlag: true },
    });
    await audit.log({
      actorUserId: session.userId,
      action: "dnc.add",
      entityType: "LeadDoNotCallList",
      entityId: row.id,
      afterJson: { phone: input.phone },
    });
    revalidatePath("/telecaller/do-not-call");
    revalidatePath("/admin/leads/do-not-call");
    revalidatePath("/admin/leads");
    return { ok: true, id: row.id };
  } catch (e) {
    return catchErr(e);
  }
}

export async function reassignLead(
  leadId: string,
  telecallerId: string,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("lead.assign");
    await requireReadableLead(leadId);
    await assignLead(leadId, session.userId, telecallerId);
    revalidatePath("/admin/leads");
    revalidatePath(`/admin/leads/${leadId}`);
    revalidatePath(`/telecaller/leads/${leadId}`);
    return { ok: true };
  } catch (e) {
    return catchErr(e);
  }
}

export async function listCounsellors() {
  return prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: UserRole.COUNSELLOR } },
    },
    select: { id: true, email: true },
    take: 50,
  });
}

/** Soft-archive: tier ARCHIVED + status LOST. */
export async function archiveLead(leadId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("lead.archive");
    const actor = await requireReadableLead(leadId);
    const before = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!before) return { ok: false, error: "Lead not found" };
    if (before.status === LeadStatus.CONVERTED) {
      return { ok: false, error: "Converted leads cannot be archived" };
    }
    if (stateMachinePersistsSideEffects(getLeadStateMachineMode())) {
      await (await import("@/lib/leads/application/archive")).archiveLead(
        leadId,
        actor,
        "Archived by admin",
      );
    } else {
    await applyAuthorizedLeadStatus(leadId, LeadStatus.LOST, {
      tier: LeadTier.ARCHIVED,
      lostReason: "Archived by admin",
      lastActivityAt: new Date(),
    });
    }
    await audit.log({
      actorUserId: session.userId,
      action: "lead.archive",
      entityType: "Lead",
      entityId: leadId,
      beforeJson: { status: before.status, tier: before.tier },
      afterJson: { status: LeadStatus.LOST, tier: LeadTier.ARCHIVED },
    });
    revalidatePath("/admin/leads");
    revalidatePath(`/admin/leads/${leadId}`);
    return { ok: true };
  } catch (e) {
    return catchErr(e);
  }
}

/** Force PII redact — BANK_SUPER_ADMIN via lead.purge. */
export async function forcePurgeLead(leadId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("lead.purge");
    await requireReadableLead(leadId);
    const before = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!before) return { ok: false, error: "Lead not found" };
    if (before.status === LeadStatus.CONVERTED) {
      return { ok: false, error: "Converted leads cannot be purged" };
    }
    const now = new Date();
    await applyAuthorizedLeadStatus(leadId, LeadStatus.EXPIRED_AUTO_PURGED, {
      fullName: null,
      phone: null,
      email: null,
      city: null,
      state: null,
      pincode: null,
      consentIp: null,
      consentUserAgent: null,
      lastActivityAt: now,
    });
    await audit.log({
      actorUserId: session.userId,
      action: "lead.purge",
      entityType: "Lead",
      entityId: leadId,
      afterJson: {
        leadCode: before.leadCode,
        score: before.score,
        tier: before.tier,
        source: before.source,
        forced: true,
      },
    });
    revalidatePath("/admin/leads");
    revalidatePath(`/admin/leads/${leadId}`);
    return { ok: true };
  } catch (e) {
    return catchErr(e);
  }
}
