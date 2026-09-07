import { NextResponse } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getConfigStoreAdapter } from "@/lib/leads/adapters/config-store-adapter";
import { canMutateConfigKey } from "@/lib/leads/config/ownership";
import {
  assertConfigKey,
  getCurrentConfig,
  proposeConfigVersion,
} from "@/lib/leads/application/config-store";
import { LeadInvariantViolationError } from "@/lib/leads/domain/errors";
import { requirePermission } from "@/lib/rbac";

const postSchema = z.object({
  payload: z.unknown(),
  notes: z.string().optional(),
  effectiveFrom: z.string().optional(),
});

function errorFromUnknown(err: unknown): Response {
  if (err instanceof Response) return err;
  if (err instanceof LeadInvariantViolationError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, context: err.context } },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
    { status: 500 },
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> },
) {
  try {
    await requirePermission("lead.config.view");
  } catch (err) {
    return errorFromUnknown(err);
  }
  const { key: raw } = await context.params;
  try {
    const key = assertConfigKey(raw);
    const current = await getCurrentConfig(prisma, key);
    const adapter = getConfigStoreAdapter(prisma);
    const version = await adapter.currentVersion(key);
    return NextResponse.json({
      key,
      version,
      payload: current?.payload ?? null,
      current,
    });
  } catch (err) {
    return errorFromUnknown(err);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ key: string }> },
) {
  let session;
  try {
    session = await requirePermission("lead.config.propose");
  } catch (err) {
    return errorFromUnknown(err);
  }
  const { key: raw } = await context.params;
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
  try {
    const key = assertConfigKey(raw);
    if (!canMutateConfigKey(session.roles, key)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Role cannot propose this key" } },
        { status: 403 },
      );
    }
    const row = await proposeConfigVersion(
      prisma,
      {
        key,
        payload: parsed.data.payload,
        notes: parsed.data.notes,
        effectiveFrom: parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : null,
        actorUserId: session.userId,
      },
      (e) => audit.log(e),
    );
    return NextResponse.json({ ok: true, version: row.version, id: row.id });
  } catch (err) {
    return errorFromUnknown(err);
  }
}
