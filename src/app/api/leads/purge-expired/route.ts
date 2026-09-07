import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LeadStatus } from "@prisma/client";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getConfigStoreAdapter } from "@/lib/leads/adapters/config-store-adapter";
import { applyAuthorizedLeadStatus } from "@/lib/leads/adapters/prisma-lead-repository";
import { resolveConfigPayload } from "@/lib/leads/application/config-store";
import { DEFAULT_RETENTION_POLICY } from "@/lib/leads/config/defaults";
import { CONFIG_KEYS } from "@/lib/leads/config/keys";
import { getLeadConfigMode } from "@/lib/leads/config/flag";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import {
  authorizeLeadCronRequest,
  hmacCronUnauthorizedJson,
} from "@/lib/security/hmac-cron";

/**
 * DPDP §8(7) erasure for unconverted leads past retentionExpiresAt.
 * Redacts PII; keeps scoring metadata for analytics.
 */
export async function POST(req: NextRequest) {
  const cron = await authorizeLeadCronRequest(req);
  const cronOk = cron.ok;

  if (!cron.ok) {
    if (!cron.allowSessionFallback) {
      return NextResponse.json(
        hmacCronUnauthorizedJson(cron.code, cron.message),
        { status: 401 },
      );
    }
    const session = await getSession();
    if (
      !session ||
      !permissionGranted(permissionsForRoles(session.roles), "lead.archive")
    ) {
      return NextResponse.json(
        hmacCronUnauthorizedJson(cron.code, cron.message),
        { status: 401 },
      );
    }
  }

  const now = new Date();
  const mode = getLeadConfigMode();
  const policy = await resolveConfigPayload(
    getConfigStoreAdapter(prisma),
    CONFIG_KEYS.RETENTION_POLICY_V1,
    DEFAULT_RETENTION_POLICY,
  );
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - policy.leadUnconvertedDays);
  const expired = await prisma.lead.findMany({
    where: {
      status: { not: LeadStatus.CONVERTED },
      NOT: { status: LeadStatus.EXPIRED_AUTO_PURGED },
      ...(mode === "off"
        ? { retentionExpiresAt: { lte: now } }
        : { capturedAt: { lte: cutoff } }),
    },
    take: 200,
  });

  let purged = 0;
  for (const lead of expired) {
    await applyAuthorizedLeadStatus(lead.id, LeadStatus.EXPIRED_AUTO_PURGED, {
      fullName: null,
      phone: null,
      email: null,
      city: null,
      state: null,
      pincode: null,
      consentIp: null,
      consentUserAgent: null,
      lastActivityAt: now,
    });
    await audit.log({
      actorUserId: cronOk ? null : (await getSession())?.userId ?? null,
      action: "lead.purge",
      entityType: "Lead",
      entityId: lead.id,
      afterJson: {
        leadCode: lead.leadCode,
        score: lead.score,
        tier: lead.tier,
        source: lead.source,
      },
    });
    purged += 1;
  }

  return NextResponse.json({ purged });
}
