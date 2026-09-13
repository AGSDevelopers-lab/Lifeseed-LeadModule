import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission, type Permission } from "@/lib/rbac";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { assertLeadReadable } from "@/lib/leads/adapters/prisma-lead-repository";
import {
  loadCounsellingBookingById,
  listCounsellingCalendar,
} from "@/lib/leads/adapters/prisma-counselling";
import { leadV2Error } from "@/lib/leads/application/follow-up-http";
import {
  bookCounsellingSession,
  cancelCounsellingBooking,
  recordCounsellingOutcome,
  recordCounsellingSession,
  rescheduleCounsellingBooking,
} from "@/lib/leads/application/counselling";
import { handleConvertRecipient } from "@/lib/leads/application/convert-http";
import { permissionGranted, permissionsForRoles } from "@/lib/rbac-permissions";

const bookBody = z.object({
  counsellorUserId: z.string().min(1),
  scheduledAt: z.string().min(1),
  mode: z.string().optional(),
  meetingUrl: z.string().optional(),
  meetingLocation: z.string().optional(),
  durationMinutes: z.number().optional(),
});

async function actorOr401() {
  const actor = await resolveLeadActor();
  if (!actor) {
    return {
      actor: null as null,
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 },
      ),
    };
  }
  return { actor, response: null };
}

export async function handleBookCounselling(leadId: string, request: Request) {
  try {
    await requirePermission("counselling.book" as Permission);
    const { actor, response } = await actorOr401();
    if (!actor || response) return response!;
    await assertLeadReadable(leadId, actor);
    const parsed = bookBody.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid booking body" } },
        { status: 400 },
      );
    }
    const result = await bookCounsellingSession(leadId, actor, {
      counsellorUserId: parsed.data.counsellorUserId,
      scheduledAt: new Date(parsed.data.scheduledAt),
      mode: parsed.data.mode,
      meetingUrl: parsed.data.meetingUrl ?? null,
      meetingLocation: parsed.data.meetingLocation ?? null,
      durationMinutes: parsed.data.durationMinutes,
    });
    return NextResponse.json({ ok: true, transitionId: result.result.id });
  } catch (err) {
    return leadV2Error(err);
  }
}

export async function handleGetCounsellingBooking(id: string) {
  try {
    await requirePermission("counselling.view" as Permission);
    const { actor, response } = await actorOr401();
    if (!actor || response) return response!;
    const loaded = await loadCounsellingBookingById(id);
    if (!loaded) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Booking not found" } },
        { status: 404 },
      );
    }
    await assertLeadReadable(loaded.booking.leadId, actor);
    return NextResponse.json({
      ok: true,
      booking: loaded.booking,
      lead: loaded.lead,
      sessions: loaded.sessions,
    });
  } catch (err) {
    return leadV2Error(err);
  }
}

export async function handleRescheduleCounselling(bookingId: string, request: Request) {
  try {
    await requirePermission("counselling.reschedule" as Permission);
    const { actor, response } = await actorOr401();
    if (!actor || response) return response!;
    const loaded = await loadCounsellingBookingById(bookingId);
    if (!loaded) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Booking not found" } },
        { status: 404 },
      );
    }
    await assertLeadReadable(loaded.booking.leadId, actor);
    const parsed = bookBody.partial().extend({
      counsellorUserId: z.string().optional(),
      scheduledAt: z.string().min(1),
    }).safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "scheduledAt is required" } },
        { status: 400 },
      );
    }
    const result = await rescheduleCounsellingBooking(loaded.booking.leadId, actor, {
      counsellorUserId: parsed.data.counsellorUserId ?? loaded.booking.counsellorUserId,
      scheduledAt: new Date(parsed.data.scheduledAt),
      mode: parsed.data.mode ?? loaded.booking.mode,
    });
    return NextResponse.json({ ok: true, transitionId: result.result.id });
  } catch (err) {
    return leadV2Error(err);
  }
}

export async function handleCancelCounselling(bookingId: string, request: Request) {
  try {
    await requirePermission("counselling.cancel" as Permission);
    const { actor, response } = await actorOr401();
    if (!actor || response) return response!;
    const loaded = await loadCounsellingBookingById(bookingId);
    if (!loaded) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Booking not found" } },
        { status: 404 },
      );
    }
    await assertLeadReadable(loaded.booking.leadId, actor);
    const json = (await request.json().catch(() => ({}))) as { reason?: string };
    const result = await cancelCounsellingBooking(loaded.booking.leadId, actor, {
      reason: json.reason,
    });
    return NextResponse.json({ ok: true, transitionId: result.result.id });
  } catch (err) {
    return leadV2Error(err);
  }
}

const sessionBody = z.object({
  attendance: z.enum(["ATTENDED", "NO_SHOW"]),
  notes: z.string().optional(),
});

export async function handleRecordSession(bookingId: string, request: Request) {
  try {
    await requirePermission("counselling.session.record" as Permission);
    const { actor, response } = await actorOr401();
    if (!actor || response) return response!;
    const loaded = await loadCounsellingBookingById(bookingId);
    if (!loaded) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Booking not found" } },
        { status: 404 },
      );
    }
    await assertLeadReadable(loaded.booking.leadId, actor);
    const parsed = sessionBody.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "attendance is required" } },
        { status: 400 },
      );
    }
    const result = await recordCounsellingSession(
      loaded.booking.leadId,
      actor,
      parsed.data.attendance === "ATTENDED" ? "attended" : "no_show",
      { notes: parsed.data.notes },
    );
    return NextResponse.json({ ok: true, transitionId: result.result.id });
  } catch (err) {
    return leadV2Error(err);
  }
}

const outcomeBody = z.object({
  recommendation: z.enum(["RECOMMEND_REGISTER", "DEFER", "DECLINE", "REFER_OUT"]),
  rationale: z.string().optional(),
  dueAt: z.string().optional(),
});

export async function handleRecordOutcome(sessionId: string, request: Request) {
  try {
    await requirePermission("counselling.outcome.record" as Permission);
    const { actor, response } = await actorOr401();
    if (!actor || response) return response!;
    const { prisma } = await import("@/lib/db");
    const session = await prisma.counsellingSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Session not found" } },
        { status: 404 },
      );
    }
    await assertLeadReadable(session.leadId, actor);
    const parsed = outcomeBody.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "recommendation is required" } },
        { status: 400 },
      );
    }
    const result = await recordCounsellingOutcome(session.leadId, actor, {
      recommendation: parsed.data.recommendation,
      notes: parsed.data.rationale,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
    });
    return NextResponse.json({ ok: true, transitionId: result.result.id });
  } catch (err) {
    return leadV2Error(err);
  }
}

export async function handleCounsellingCalendar(request: Request) {
  try {
    await requirePermission("counselling.view" as Permission);
    const { actor, response } = await actorOr401();
    if (!actor || response) return response!;
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "from and to are required" } },
        { status: 400 },
      );
    }
    const held = permissionsForRoles(actor.roles as never);
    const canAny = permissionGranted(held, "lead.view.any");
    const requestedCounsellor = url.searchParams.get("counsellor") ?? undefined;
    const counsellorUserId = canAny ? requestedCounsellor : actor.userId;
    const rows = await listCounsellingCalendar({
      counsellorUserId,
      from: new Date(from),
      to: new Date(to),
    });
    return NextResponse.json({ ok: true, bookings: rows });
  } catch (err) {
    return leadV2Error(err);
  }
}

export async function handleSessionConvertRecipient(sessionId: string, request: Request) {
  const { prisma } = await import("@/lib/db");
  const session = await prisma.counsellingSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Session not found" } },
      { status: 404 },
    );
  }
  return handleConvertRecipient(session.leadId, request);
}
