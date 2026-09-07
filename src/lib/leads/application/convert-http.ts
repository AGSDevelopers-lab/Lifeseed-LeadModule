import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/rbac";
import type { Permission } from "@/lib/rbac";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { LeadDomainError } from "@/lib/leads/domain/errors";
import { assertLeadReadable } from "@/lib/leads/adapters/prisma-lead-repository";
import {
  convertDonor,
  convertRecipient,
  getConversionEligibility,
} from "@/lib/leads/application/convert";

const donorBody = z.object({
  dob: z.string().min(1),
  gender: z.enum(["M", "F", "O"]),
  siteId: z.string().min(1),
  aadhaarHash: z.string().optional(),
  maritalStatus: z.string().optional(),
  hasLivingChild: z.boolean().optional(),
  panMasked: z.string().optional(),
  addressLine: z.string().optional(),
  preferredIntakeAt: z.string().optional(),
  coordinatorUserId: z.string().optional(),
});

const recipientBody = z.object({
  clinicId: z.string().min(1),
  partnerName: z.string().optional(),
  dob: z.string().optional(),
});

function errorResponse(err: unknown): Response {
  if (err instanceof LeadDomainError) {
    const code =
      err.code === "LEAD_DUPLICATE_CONVERSION" ? "DUPLICATE_CONVERSION" : err.code;
    const status = code === "DUPLICATE_CONVERSION" ? 409 : err.code === "LEAD_OWNERSHIP_DENIED" ? 403 : 400;
    return NextResponse.json({ error: { code, message: err.message, details: err.context } }, { status });
  }
  if (err instanceof Response) return err;
  return NextResponse.json(
    { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
    { status: 500 },
  );
}

async function actorOr401() {
  const actor = await resolveLeadActor();
  if (!actor) {
    return { actor: null, response: NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 }) };
  }
  return { actor, response: null };
}

export async function handleConvertDonor(leadId: string, request: Request): Promise<Response> {
  try {
    await requirePermission("lead.convert" as Permission);
    await requirePermission("donor.create" as Permission);
  } catch (e) {
    return errorResponse(e);
  }
  const { actor, response } = await actorOr401();
  if (!actor || response) return response!;
  try {
    await assertLeadReadable(leadId, actor);
    const json = await request.json().catch(() => ({}));
    const parsed = donorBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid body" } }, { status: 400 });
    }
    const result = await convertDonor(leadId, actor, parsed.data);
    if (!result.ok) {
      const status = result.code === "DUPLICATE_CONVERSION" ? 409 : 400;
      return NextResponse.json(
        { error: { code: result.code ?? "CONVERSION_FAILED", message: result.error } },
        { status },
      );
    }
    return NextResponse.json({ ok: true, donorId: result.donorId, donorCode: result.donorCode });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function handleConvertRecipient(leadId: string, request: Request): Promise<Response> {
  try {
    await requirePermission("lead.convert" as Permission);
  } catch (e) {
    return errorResponse(e);
  }
  const { actor, response } = await actorOr401();
  if (!actor || response) return response!;
  try {
    await assertLeadReadable(leadId, actor);
    const json = await request.json().catch(() => ({}));
    const parsed = recipientBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid body" } }, { status: 400 });
    }
    const result = await convertRecipient(leadId, actor, parsed.data);
    if (!result.ok) {
      const status = result.code === "DUPLICATE_CONVERSION" ? 409 : 400;
      return NextResponse.json(
        { error: { code: result.code ?? "CONVERSION_FAILED", message: result.error } },
        { status },
      );
    }
    return NextResponse.json({
      ok: true,
      recipientId: result.recipientId,
      recipientCode: result.recipientCode,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function handleConvertEligibility(leadId: string): Promise<Response> {
  try {
    await requirePermission("lead.view" as Permission);
  } catch (e) {
    return errorResponse(e);
  }
  const { actor, response } = await actorOr401();
  if (!actor || response) return response!;
  try {
    await assertLeadReadable(leadId, actor);
    const eligibility = await getConversionEligibility(leadId);
    return NextResponse.json({ ok: true, eligibility });
  } catch (err) {
    return errorResponse(err);
  }
}
