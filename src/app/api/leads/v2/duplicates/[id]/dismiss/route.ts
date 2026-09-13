import { NextResponse } from "next/server";

import { dismissDuplicateCase } from "@/lib/leads/application/duplicate";
import { isLeadDuplicateEnabled } from "@/lib/leads/application/feature-flag";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { LeadDomainError } from "@/lib/leads/domain/errors";
import { requirePermission } from "@/lib/rbac";

function errorFromUnknown(err: unknown): Response {
  if (err instanceof Response) return err;
  if (err instanceof LeadDomainError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.context } },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
    { status: 500 },
  );
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isLeadDuplicateEnabled()) {
    return NextResponse.json(
      { error: { code: "FEATURE_OFF", message: "Lead duplicate detection is disabled" } },
      { status: 404 },
    );
  }
  try {
    await requirePermission("duplicate.review");
  } catch (err) {
    return errorFromUnknown(err);
  }
  const actor = await resolveLeadActor();
  if (!actor) {
    return NextResponse.json(
      { error: { code: "AUTHENTICATION_REQUIRED", message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const { id } = await ctx.params;
  let notes: string | undefined;
  try {
    const json = (await request.json()) as { notes?: string };
    notes = json.notes;
  } catch {
    notes = undefined;
  }
  try {
    const item = await dismissDuplicateCase(id, actor, notes);
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    return errorFromUnknown(err);
  }
}
