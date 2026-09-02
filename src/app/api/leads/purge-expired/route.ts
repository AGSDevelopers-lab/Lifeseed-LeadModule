import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LeadStatus } from "@prisma/client";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

/**
 * DPDP §8(7) erasure for unconverted leads past retentionExpiresAt.
 * Redacts PII; keeps scoring metadata for analytics.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.LEADS_CRON_SECRET ?? process.env.CRON_SECRET;
  const header = req.headers.get("x-cron-secret");
  const cronOk = Boolean(secret && header && header === secret);

  if (!cronOk) {
    const session = await getSession();
    if (
      !session ||
      !permissionGranted(permissionsForRoles(session.roles), "lead.archive")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const expired = await prisma.lead.findMany({
    where: {
      retentionExpiresAt: { lte: now },
      status: { not: LeadStatus.CONVERTED },
      NOT: { status: LeadStatus.EXPIRED_AUTO_PURGED },
    },
    take: 200,
  });

  let purged = 0;
  for (const lead of expired) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: LeadStatus.EXPIRED_AUTO_PURGED,
        fullName: null,
        phone: null,
        email: null,
        city: null,
        state: null,
        pincode: null,
        consentIp: null,
        consentUserAgent: null,
        lastActivityAt: now,
      },
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
