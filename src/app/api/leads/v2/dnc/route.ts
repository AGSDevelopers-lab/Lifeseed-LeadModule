import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { DncChannel, DncSource } from "@/lib/leads/domain/enums";
import { addDnc, listDnc } from "@/lib/leads/application/dnc";

const postSchema = z.object({
  channel: z.enum(["PHONE", "EMAIL", "WHATSAPP", "SMS", "ALL"]),
  value: z.string().min(1),
  reason: z.string().min(1),
  source: z
    .enum([
      "SELF_REQUEST",
      "OPS_ADD",
      "COMPLIANCE_ADD",
      "LEAD_REQUEST",
      "REGULATOR",
      "SYSTEM",
      "UNSUBSCRIBE_LINK",
      "MANUAL",
    ])
    .optional(),
  effectiveFrom: z.string().optional(),
  effectiveUntil: z.string().nullable().optional(),
  entries: z
    .array(
      z.object({
        channel: z.enum(["PHONE", "EMAIL", "WHATSAPP", "SMS", "ALL"]),
        value: z.string().min(1),
        reason: z.string().min(1),
      }),
    )
    .optional(),
});

function errorFromUnknown(err: unknown): Response {
  if (err instanceof Response) return err;
  return NextResponse.json(
    { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    await requirePermission("dnc.view");
  } catch (err) {
    return errorFromUnknown(err);
  }
  const url = new URL(request.url);
  const channel = url.searchParams.get("channel") as
    | (typeof DncChannel)[keyof typeof DncChannel]
    | null;
  const value = url.searchParams.get("value") ?? undefined;
  const rows = await listDnc({
    channel: channel && channel in DncChannel ? channel : undefined,
    value,
  });
  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      channel: r.channel,
      value: r.value,
      normalisedValue: r.normalisedValue,
      phone: r.phone,
      email: r.email,
      reason: r.reason,
      source: r.source,
      effectiveFrom: r.effectiveFrom.toISOString(),
      effectiveUntil: r.effectiveUntil?.toISOString() ?? null,
      removalAuthorityUserId: r.removalAuthorityUserId,
      removedAt: r.removedAt?.toISOString() ?? null,
      createdByUserId: r.createdByUserId,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requirePermission("dnc.add");
  } catch (err) {
    return errorFromUnknown(err);
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON" } },
      { status: 400 },
    );
  }
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid body" } },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const toCreate = body.entries?.length
    ? body.entries
    : [{ channel: body.channel, value: body.value, reason: body.reason }];
  const created = [];
  for (const entry of toCreate) {
    const row = await addDnc({
      channel: entry.channel,
      value: entry.value,
      reason: entry.reason,
      source: (body.source as (typeof DncSource)[keyof typeof DncSource]) ?? DncSource.MANUAL,
      createdByUserId: session.userId,
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
      effectiveUntil: body.effectiveUntil ? new Date(body.effectiveUntil) : null,
    });
    created.push(row);
    await audit.log({
      actorUserId: session.userId,
      action: "dnc.add",
      entityType: "LeadDoNotCall",
      entityId: row.id,
      afterJson: { channel: row.channel, normalisedValue: row.normalisedValue },
    });
  }
  return NextResponse.json({ ok: true, items: created.map((r) => ({ id: r.id })) });
}
