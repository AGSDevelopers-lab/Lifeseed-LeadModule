import { NextResponse } from "next/server";
import { CycleEventType, CycleLocation } from "@prisma/client";
import { z } from "zod";

import {
  eventPayloadSchemas,
  recordEvent,
  WITNESS_REQUIRED,
} from "@/lib/embryology/cycle-events";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

const bodySchema = z.object({
  eventType: z.nativeEnum(CycleEventType),
  payload: z.unknown(),
  occurredAt: z.string().datetime().optional(),
  location: z.nativeEnum(CycleLocation).optional(),
  witnessUserId: z.string().optional(),
});

type RouteCtx = { params: Promise<{ drfId: string }> };

export async function POST(req: Request, ctx: RouteCtx) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !permissionGranted(permissionsForRoles(session.roles), "cycle.log_event")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { drfId } = await ctx.params;
  const drf = await prisma.dRF.findUnique({ where: { id: drfId } });
  if (!drf) {
    return NextResponse.json({ error: "DRF not found" }, { status: 404 });
  }
  if (session.clinicId && session.clinicId !== drf.clinicId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { eventType, payload, occurredAt, location, witnessUserId } =
    parsed.data;
  const payloadSchema = eventPayloadSchemas[eventType];
  const payloadParsed = payloadSchema.safeParse(payload);
  if (!payloadParsed.success) {
    return NextResponse.json(
      { error: "Invalid event payload", issues: payloadParsed.error.flatten() },
      { status: 400 },
    );
  }

  if (WITNESS_REQUIRED.includes(eventType) && !witnessUserId) {
    return NextResponse.json(
      { error: "2-witness required for this event" },
      { status: 400 },
    );
  }

  try {
    const event = await recordEvent({
      drfId,
      eventType,
      payload: payloadParsed.data,
      actorUserId: session.userId,
      clinicId: drf.clinicId,
      location: location ?? CycleLocation.L2,
      occurredAt: occurredAt ? new Date(occurredAt) : undefined,
      witnessUserId,
    });
    return NextResponse.json({ event }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to record event";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
