import { NextResponse } from "next/server";

import { isLeadFollowUpEnabled } from "@/lib/leads/application/feature-flag";
import { LeadDomainError } from "@/lib/leads/domain/errors";

export function followUpFlagOffResponse(): Response | null {
  if (isLeadFollowUpEnabled()) return null;
  return NextResponse.json(
    { error: { code: "FEATURE_OFF", message: "Lead follow-up is disabled" } },
    { status: 404 },
  );
}

export function leadV2Error(err: unknown): Response {
  if (err instanceof Response) return err;
  if (err instanceof LeadDomainError) {
    const status =
      err.code === "LEAD_OWNERSHIP_DENIED"
        ? 403
        : err.code === "LEAD_INVARIANT_VIOLATION"
          ? 400
          : 400;
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status },
    );
  }
  return NextResponse.json(
    { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Failed" } },
    { status: 500 },
  );
}
