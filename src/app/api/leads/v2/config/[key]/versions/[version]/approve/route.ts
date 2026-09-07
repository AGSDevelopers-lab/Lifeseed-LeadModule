import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getConfigStoreAdapter } from "@/lib/leads/adapters/config-store-adapter";
import {
  approveConfigVersion,
  assertConfigKey,
  ConfigSodViolationError,
} from "@/lib/leads/application/config-store";
import { canMutateConfigKey } from "@/lib/leads/config/ownership";
import { LeadInvariantViolationError } from "@/lib/leads/domain/errors";
import { requirePermission } from "@/lib/rbac";

function errorFromUnknown(err: unknown): Response {
  if (err instanceof Response) return err;
  if (err instanceof ConfigSodViolationError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: 409 },
    );
  }
  if (err instanceof LeadInvariantViolationError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
    { status: 500 },
  );
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ key: string; version: string }> },
) {
  let session;
  try {
    session = await requirePermission("lead.config.approve");
  } catch (err) {
    return errorFromUnknown(err);
  }
  const { key: raw, version: versionRaw } = await context.params;
  const version = Number(versionRaw);
  if (!Number.isInteger(version)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid version" } },
      { status: 400 },
    );
  }
  try {
    const key = assertConfigKey(raw);
    if (!canMutateConfigKey(session.roles, key)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Role cannot approve this key" } },
        { status: 403 },
      );
    }
    const row = await approveConfigVersion(
      prisma,
      { key, version, actorUserId: session.userId },
      (e) => audit.log(e),
      getConfigStoreAdapter(prisma),
    );
    return NextResponse.json({
      ok: true,
      version: row.version,
      isActive: row.isActive,
      effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
    });
  } catch (err) {
    return errorFromUnknown(err);
  }
}
