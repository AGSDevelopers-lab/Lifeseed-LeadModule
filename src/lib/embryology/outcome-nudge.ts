import { DrfState, NudgeStatus, type Prisma } from "@prisma/client";

import { audit } from "@/lib/audit";
import { advanceDrf } from "@/lib/drf-state";
import { prisma } from "@/lib/db";
import { scheduleEmbryologyOutcomeSlas } from "@/lib/sla/migration-shim";

const OFFSETS = [14, 30, 90, 180] as const;

export async function scheduleNudges(
  drfId: string,
  transferredAt: Date,
): Promise<void> {
  for (const dayOffset of OFFSETS) {
    const scheduledAt = new Date(transferredAt);
    scheduledAt.setUTCDate(scheduledAt.getUTCDate() + dayOffset);
    await prisma.outcomeNudge.upsert({
      where: { drfId_dayOffset: { drfId, dayOffset } },
      create: {
        drfId,
        dayOffset,
        scheduledAt,
        status: NudgeStatus.PENDING,
      },
      update: {}, // idempotent — do not reschedule if exists
    });
  }
  // Also mirror onto generic SLA engine (backward-compatible)
  await scheduleEmbryologyOutcomeSlas(drfId, transferredAt);
}

export async function runPendingNudges(actorUserId?: string | null): Promise<{
  sent: number;
  skipped: number;
}> {
  const now = new Date();
  const pending = await prisma.outcomeNudge.findMany({
    where: {
      status: NudgeStatus.PENDING,
      scheduledAt: { lte: now },
    },
    include: {
      drf: { include: { clinic: true } },
    },
    take: 200,
  });

  let sent = 0;
  let skipped = 0;

  for (const nudge of pending) {
    // Skip if cycle already closed with outcome
    if (
      nudge.drf.state === DrfState.CLOSED ||
      nudge.drf.state === DrfState.CANCELLED
    ) {
      await prisma.outcomeNudge.update({
        where: { id: nudge.id },
        data: { status: NudgeStatus.SKIPPED, sentAt: now },
      });
      skipped += 1;
      continue;
    }

    const email = nudge.drf.clinic.primaryEmail;
    const subject = `LifeSeed outcome feedback reminder · Day ${nudge.dayOffset} · ${nudge.drf.drfNumber}`;
    const body = [
      `Dear ${nudge.drf.clinic.name},`,
      "",
      `Please report cycle outcome for DRF ${nudge.drf.drfNumber}.`,
      `This is the Day-${nudge.dayOffset} auto-nudge from LifeSeed Bank.`,
      "",
      "Log beta-hCG / clinical pregnancy / live birth in Clinic Portal → Cycles.",
      "",
      "— LifeSeed Medical Coordination",
    ].join("\n");

    // Stub send — emit event + audit (no real SMTP in v1)
    await prisma.eventEmission.create({
      data: {
        eventName: "outcome.nudge",
        payload: {
          nudgeId: nudge.id,
          drfId: nudge.drfId,
          dayOffset: nudge.dayOffset,
          to: email,
          subject,
          body,
        } as Prisma.InputJsonValue,
        targetSystem: "INTERNAL",
        consumerStatus: "PENDING",
      },
    });

    await prisma.outcomeNudge.update({
      where: { id: nudge.id },
      data: { status: NudgeStatus.SENT, sentAt: now },
    });

    await audit.log({
      actorUserId: actorUserId ?? null,
      action: "NOTIFY",
      entityType: "OutcomeNudge",
      entityId: nudge.id,
      afterJson: { subject, to: email, dayOffset: nudge.dayOffset },
    });

    sent += 1;
  }

  return { sent, skipped };
}

/**
 * Day-180 with no outcome → CLOSED_NO_OUTCOME on cohort + DRF CLOSED.
 */
export async function autoCloseNoOutcome(
  actorUserId?: string | null,
): Promise<{ closed: number }> {
  const now = new Date();
  const day180 = await prisma.outcomeNudge.findMany({
    where: {
      dayOffset: 180,
      scheduledAt: { lte: now },
      status: { in: [NudgeStatus.SENT, NudgeStatus.PENDING] },
      drf: {
        state: { in: [DrfState.IN_CYCLE, DrfState.OUTCOME_PENDING] },
      },
    },
    include: { drf: { include: { cohort: true } } },
    take: 100,
  });

  let closed = 0;
  for (const n of day180) {
    if (n.drf.cohort?.outcome) continue;

    if (n.drf.cohort) {
      await prisma.embryoCohort.update({
        where: { id: n.drf.cohort.id },
        data: {
          outcome: "CLOSED_NO_OUTCOME",
          closedAt: now,
          outcomeReportedAt: now,
        },
      });
    }

    try {
      if (n.drf.state === DrfState.IN_CYCLE) {
        await advanceDrf(n.drfId, DrfState.OUTCOME_PENDING, {
          actorUserId: actorUserId ?? "system",
          reason: "Day-180 auto-close — no outcome reported",
          data: { outcomeType: "CLOSED_NO_OUTCOME" },
        });
      }
      await advanceDrf(n.drfId, DrfState.CLOSED, {
        actorUserId: actorUserId ?? "system",
        reason: "Day-180 auto-close — no outcome reported",
        data: {
          outcomeType: "CLOSED_NO_OUTCOME",
          outcomeReportedAt: now,
        },
      });
      closed += 1;
    } catch {
      // Illegal transition — skip
    }

    await prisma.outcomeNudge.update({
      where: { id: n.id },
      data: { status: NudgeStatus.SKIPPED, sentAt: now },
    });
  }

  return { closed };
}
