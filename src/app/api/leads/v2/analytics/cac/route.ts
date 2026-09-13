import { NextResponse } from "next/server";

import { computeCampaignCac, type CacScope } from "@/lib/leads/application/attribution";
import { resolveLeadActor } from "@/lib/leads/adapters/identity-adapter";
import { LeadDomainError } from "@/lib/leads/domain/errors";
import { requirePermission } from "@/lib/rbac";

export async function GET(request: Request) {
  try {
    await requirePermission("analytics.view");
    const actor = await resolveLeadActor();
    if (!actor) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
    }
    const url = new URL(request.url);
    const scopeRaw = url.searchParams.get("scope") ?? "donor";
    if (scopeRaw !== "donor" && scopeRaw !== "recipient") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "scope must be donor or recipient" } },
        { status: 400 },
      );
    }
    const fromRaw = url.searchParams.get("from");
    const toRaw = url.searchParams.get("to");
    const items = await computeCampaignCac({
      actor,
      scope: scopeRaw as CacScope,
      from: fromRaw ? new Date(fromRaw) : null,
      to: toRaw ? new Date(toRaw) : null,
    });
    return NextResponse.json({ apiVersion: "v2", scope: scopeRaw, items });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof LeadDomainError) {
      const status = err.code === "LEAD_PERMISSION_DENIED" ? 403 : 400;
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
}
