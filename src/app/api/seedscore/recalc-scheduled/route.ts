import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DonorStatus, type Prisma } from "@prisma/client";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { isSeedScoreRecalcOnSchedule } from "@/lib/seedscore/constants";

/**
 * Marks ACTIVE donors due for 6-month SeedScore review.
 * Does NOT auto-recalc — sets scoreRecalcRequired for BRM.
 * Auth: X-Cron-Secret = SEEDSCORE_CRON_SECRET (fallback CRON_SECRET).
 */
export async function POST(req: NextRequest) {
  const expected =
    process.env.SEEDSCORE_CRON_SECRET || process.env.CRON_SECRET;
  const header = req.headers.get("x-cron-secret");
  if (!expected || !header || header !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSeedScoreRecalcOnSchedule()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "SEEDSCORE_RECALC_ON_SCHEDULE is false",
    });
  }

  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);

  const due = await prisma.donor.findMany({
    where: {
      status: DonorStatus.ACTIVE,
      OR: [
        { lastScoredAt: { lt: cutoff } },
        { lastScoredAt: null, firstScoredAt: { lt: cutoff } },
      ],
      scoreRecalcRequired: false,
    },
    select: { id: true, donorCode: true },
    take: 500,
  });

  if (due.length === 0) {
    return NextResponse.json({ ok: true, flagged: 0 });
  }

  await prisma.donor.updateMany({
    where: { id: { in: due.map((d) => d.id) } },
    data: { scoreRecalcRequired: true },
  });

  await prisma.eventEmission.create({
    data: {
      eventName: "seedscore.recalc.due",
      payload: {
        count: due.length,
        donorIds: due.map((d) => d.id),
        donorCodes: due.map((d) => d.donorCode),
        notify: "BANK_BRM",
      } as Prisma.InputJsonValue,
      targetSystem: "INTERNAL",
      consumerStatus: "PENDING",
    },
  });

  await audit.log({
    actorUserId: null,
    action: "seedscore.cron.flag",
    entityType: "SeedScore",
    entityId: "scheduled-6m",
    afterJson: { flagged: due.length },
  });

  return NextResponse.json({ ok: true, flagged: due.length });
}
