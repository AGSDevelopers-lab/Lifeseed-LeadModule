import { NextResponse } from "next/server";
import { z } from "zod";

import { mergeDuplicateCase } from "@/lib/leads/application/merge";
import { isLeadDuplicateEnabled } from "@/lib/leads/application/feature-flag";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { LeadDomainError } from "@/lib/leads/domain/errors";
import { requirePermission } from "@/lib/rbac";

const bodySchema = z.object({
  winnerLeadId: z.string().min(1),
  reason: z.string().min(1),
  strategy: z.enum(["COPY_ALL", "COPY_MEANINGFUL", "REFERENCE_ONLY"]),
});

function errorFromUnknown(err: unknown): Response {
  if (err instanceof Response) return err;
  if (err instanceof LeadDomainError) {
    const status =
      err.code === "LEAD_CONVERTED_MERGE_LOSER" || err.code === "LEAD_MERGE_ALREADY_EXISTS"
        ? 409
        : 400;
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.context } },
      { status },
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
    await requirePermission("lead.merge");
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
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON" } },
      { status: 400 },
    );
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid body" } },
      { status: 400 },
    );
  }
  try {
    const result = await mergeDuplicateCase({
      duplicateCaseId: id,
      winnerLeadId: parsed.data.winnerLeadId,
      reason: parsed.data.reason,
      strategy: parsed.data.strategy,
      actor,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return errorFromUnknown(err);
  }
}
