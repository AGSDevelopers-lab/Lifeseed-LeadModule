import {
  BookingStatus,
  LeadActivityType,
  MergeCopyStrategy,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import { prismaLeadRepository, LEAD_INTERACTIVE_TX_OPTIONS } from "@/lib/leads/adapters/prisma-lead-repository";
import { PrismaLeadTransitionStore } from "@/lib/leads/adapters/prisma-transition-store";
import { isLeadDuplicateEnabled } from "@/lib/leads/application/feature-flag";
import { actorHasPerm, buildGuardFacts } from "@/lib/leads/application/guard-facts";
import { t31MergeLoser } from "@/lib/leads/domain/state-machine/transitions";
import { DupReviewStatus } from "@/lib/leads/domain/enums";
import {
  LeadConvertedMergeLoserError,
  LeadGuardFailedError,
  LeadMergeAlreadyExistsError,
} from "@/lib/leads/domain/errors";
import type { ActorContext } from "@/lib/leads/domain/ports/shared";

import { mergeLoserStub } from "./commands";

export { mergeLoserStub as applyMergeLoserTransition };

type Tx = Prisma.TransactionClient;

const MEANINGFUL_TYPES: LeadActivityType[] = [
  LeadActivityType.CALL,
  LeadActivityType.COUNSELLING,
  LeadActivityType.NOTE,
  LeadActivityType.CONVERSION,
];

function tagMeta(
  existing: Prisma.JsonValue | null | undefined,
  loserLeadId: string,
): Prisma.InputJsonValue {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return { ...base, mergeSourceLeadId: loserLeadId } as Prisma.InputJsonValue;
}

async function copyActivities(
  tx: Tx,
  winnerLeadId: string,
  loserLeadId: string,
  strategy: MergeCopyStrategy,
): Promise<number> {
  if (strategy === MergeCopyStrategy.REFERENCE_ONLY) {
    const acts = await tx.leadActivity.findMany({
      where: { leadId: loserLeadId },
      select: { activityType: true },
    });
    const tally = new Map<string, number>();
    for (const a of acts) {
      tally.set(a.activityType, (tally.get(a.activityType) ?? 0) + 1);
    }
    const summary = [...tally.entries()].map(([k, v]) => `${k}:${v}`).join(", ");
    await tx.leadActivity.create({
      data: {
        leadId: winnerLeadId,
        activityType: LeadActivityType.MERGE,
        occurredAt: new Date(),
        summary: `Merge reference only from ${loserLeadId} (${summary || "0 activities"})`,
        metadata: { mergeSourceLeadId: loserLeadId, strategy },
      },
    });
    return 1;
  }

  const activities = await tx.leadActivity.findMany({ where: { leadId: loserLeadId } });
  const toCopy =
    strategy === MergeCopyStrategy.COPY_MEANINGFUL
      ? activities.filter((a) => MEANINGFUL_TYPES.includes(a.activityType))
      : activities;
  const activityIdMap = new Map<string, string>();
  for (const row of toCopy) {
    const created = await tx.leadActivity.create({
      data: {
        leadId: winnerLeadId,
        activityType: row.activityType,
        channel: row.channel,
        actorUserId: row.actorUserId,
        actorRole: row.actorRole,
        occurredAt: row.occurredAt,
        summary: row.summary,
        outcome: row.outcome,
        nextAction: row.nextAction,
        nextActionDueAt: row.nextActionDueAt,
        metadata: tagMeta(row.metadata, loserLeadId),
        relatedEntityType: row.relatedEntityType,
        relatedEntityId: row.relatedEntityId,
      },
    });
    activityIdMap.set(row.id, created.id);
  }
  let copied = toCopy.length;

  if (strategy !== MergeCopyStrategy.COPY_ALL) {
    return copied;
  }

  const calls = await tx.callDisposition.findMany({ where: { leadId: loserLeadId } });
  for (const row of calls) {
    await tx.callDisposition.create({
      data: {
        leadId: winnerLeadId,
        telecallerId: row.telecallerId,
        callStartedAt: row.callStartedAt,
        callEndedAt: row.callEndedAt,
        durationSeconds: row.durationSeconds,
        disposition: row.disposition,
        notes: row.notes,
        followupAt: row.followupAt,
        qaScore: row.qaScore,
        qaSampledByUserId: row.qaSampledByUserId,
        qaSampledAt: row.qaSampledAt,
        recordingUrl: row.recordingUrl,
        activityId: row.activityId ? activityIdMap.get(row.activityId) ?? null : null,
      },
    });
    copied += 1;
  }

  const followUps = await tx.leadFollowUp.findMany({ where: { leadId: loserLeadId } });
  for (const row of followUps) {
    await tx.leadFollowUp.create({
      data: {
        leadId: winnerLeadId,
        ownerUserId: row.ownerUserId,
        type: row.type,
        priority: row.priority,
        reason: row.reason,
        dueAt: row.dueAt,
        status: row.status,
        completedAt: row.completedAt,
        completedByUserId: row.completedByUserId,
        outcome: row.outcome,
        cancelReason: row.cancelReason,
        slaScheduleId: null,
      },
    });
    copied += 1;
  }

  const histories = await tx.leadStatusHistory.findMany({ where: { leadId: loserLeadId } });
  for (const row of histories) {
    await tx.leadActivity.create({
      data: {
        leadId: winnerLeadId,
        activityType: LeadActivityType.SYSTEM,
        occurredAt: row.occurredAt,
        summary: `Merge note: ${row.fromStatus ?? "∅"} → ${row.toStatus} (${row.event})`,
        metadata: {
          mergeSourceLeadId: loserLeadId,
          fromStatus: row.fromStatus,
          toStatus: row.toStatus,
          event: row.event,
        },
      },
    });
    copied += 1;
  }

  const winnerScheduled = await tx.counsellingBooking.findFirst({
    where: { leadId: winnerLeadId, bookingStatus: BookingStatus.SCHEDULED },
  });
  const bookings = await tx.counsellingBooking.findMany({
    where: { leadId: loserLeadId },
    orderBy: { createdAt: "asc" },
  });
  const bookingIdMap = new Map<string, string>();
  for (const row of bookings) {
    let bookingStatus = row.bookingStatus;
    let followupNotes = row.followupNotes;
    if (row.bookingStatus === BookingStatus.SCHEDULED && winnerScheduled) {
      bookingStatus = BookingStatus.CLOSED;
      followupNotes = [followupNotes, "copied-from-merge: demoted SCHEDULED to preserve one-SCHEDULED-per-lead"]
        .filter(Boolean)
        .join("; ");
    }
    const created = await tx.counsellingBooking.create({
      data: {
        leadId: winnerLeadId,
        bookedAt: row.bookedAt,
        scheduledAt: row.scheduledAt,
        durationMinutes: row.durationMinutes,
        mode: row.mode,
        counsellorUserId: row.counsellorUserId,
        meetingUrl: row.meetingUrl,
        meetingLocation: row.meetingLocation,
        reminderSentAt: row.reminderSentAt,
        status: row.status,
        attendedAt: row.attendedAt,
        cancelledAt: row.cancelledAt,
        cancelledReason: row.cancelledReason,
        followupNotes,
        bookingStatus,
        cancelledByUserId: row.cancelledByUserId,
      },
    });
    bookingIdMap.set(row.id, created.id);
    copied += 1;
  }

  const sessions = await tx.counsellingSession.findMany({ where: { leadId: loserLeadId } });
  const sessionIdMap = new Map<string, string>();
  for (const row of sessions) {
    const newBookingId = bookingIdMap.get(row.bookingId);
    if (!newBookingId) continue;
    const created = await tx.counsellingSession.create({
      data: {
        bookingId: newBookingId,
        leadId: winnerLeadId,
        counsellorUserId: row.counsellorUserId,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        attendanceStatus: row.attendanceStatus,
        notes: row.notes ? `${row.notes} [mergeSourceLeadId=${loserLeadId}]` : `mergeSourceLeadId=${loserLeadId}`,
        recordedByUserId: row.recordedByUserId,
        recordedAt: row.recordedAt,
      },
    });
    sessionIdMap.set(row.id, created.id);
    copied += 1;
  }

  const outcomes = await tx.counsellingOutcome.findMany({ where: { leadId: loserLeadId } });
  for (const row of outcomes) {
    const newSessionId = sessionIdMap.get(row.sessionId);
    if (!newSessionId) continue;
    await tx.counsellingOutcome.create({
      data: {
        sessionId: newSessionId,
        leadId: winnerLeadId,
        recommendation: row.recommendation,
        recommendedByUserId: row.recommendedByUserId,
        rationale: row.rationale
          ? `${row.rationale} [mergeSourceLeadId=${loserLeadId}]`
          : `mergeSourceLeadId=${loserLeadId}`,
        nextActionType: row.nextActionType,
        nextActionAt: row.nextActionAt,
      },
    });
    copied += 1;
  }

  return copied;
}

export type MergeDuplicateInput = {
  duplicateCaseId: string;
  winnerLeadId: string;
  reason: string;
  strategy: MergeCopyStrategy;
  actor: ActorContext;
  /** Test-only: throw after the five algorithm writes, before commit. */
  throwAfterWrites?: boolean;
};

export async function mergeDuplicateCase(input: MergeDuplicateInput) {
  if (!isLeadDuplicateEnabled()) {
    throw new LeadGuardFailedError("Duplicate merge is disabled", { flag: "LEAD_DUPLICATE_ENABLED" });
  }
  const { duplicateCaseId, winnerLeadId, reason, strategy, actor } = input;
  if (!reason.trim()) {
    throw new LeadGuardFailedError("Merge reason is required");
  }

  return prisma.$transaction(async (tx) => {
    const dup = await tx.duplicateCase.findUnique({ where: { id: duplicateCaseId } });
    if (!dup) throw new LeadGuardFailedError("Duplicate case not found", { duplicateCaseId });
    if (
      dup.reviewStatus === DupReviewStatus.MERGED ||
      dup.reviewStatus === DupReviewStatus.KEPT_SEPARATE ||
      dup.reviewStatus === DupReviewStatus.DISMISSED
    ) {
      throw new LeadGuardFailedError("Duplicate case is already resolved", {
        reviewStatus: dup.reviewStatus,
      });
    }
    if (winnerLeadId !== dup.leftLeadId && winnerLeadId !== dup.rightLeadId) {
      throw new LeadGuardFailedError("winnerLeadId must be one of the duplicate pair");
    }
    const loserLeadId = winnerLeadId === dup.leftLeadId ? dup.rightLeadId : dup.leftLeadId;

    const loserRow = await tx.lead.findUnique({ where: { id: loserLeadId } });
    if (!loserRow) throw new LeadGuardFailedError("Loser lead not found", { loserLeadId });
    if (loserRow.convertedDonorId || loserRow.convertedRecipientId) {
      throw new LeadConvertedMergeLoserError("Converted leads cannot be merged as losers", {
        loserLeadId,
        convertedDonorId: loserRow.convertedDonorId,
        convertedRecipientId: loserRow.convertedRecipientId,
      });
    }

    let mergeRow;
    try {
      mergeRow = await tx.leadMerge.create({
        data: {
          duplicateCaseId,
          winnerLeadId,
          loserLeadId,
          decidedByUserId: actor.userId,
          reason,
          activityCopyStrategy: strategy,
          activitiesCopiedCount: 0,
          mergedAt: new Date(),
        },
      });
    } catch (err) {
      if (
        typeof err === "object" &&
        err &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        throw new LeadMergeAlreadyExistsError("Loser lead has already been merged", { loserLeadId });
      }
      throw err;
    }

    const existingMerge = await tx.leadMerge.findUnique({ where: { loserLeadId } });
    if (!existingMerge) {
      throw new LeadGuardFailedError("LeadMerge row required", { loserLeadId });
    }

    const loser = await prismaLeadRepository.byId(loserLeadId, actor);
    if (!loser) throw new LeadGuardFailedError("Loser lead not found", { loserLeadId });

    const hasPermission = await actorHasPerm(actor, "lead.merge");
    const facts = buildGuardFacts({
      lead: loser,
      actor,
      hasPermission,
      leadMergeExists: Boolean(existingMerge),
      reasonPresent: true,
    });
    const now = new Date();
    const result = t31MergeLoser(loser, {
      now,
      actor,
      payload: { winnerLeadId, reason },
      facts,
    });

    const store = new PrismaLeadTransitionStore(prisma);
    await store.persistBundleWithClient(tx as never, {
      lead: loser,
      nextStatus: result.nextStatus,
      writes: result.writes,
      actorUserId: actor.userId,
      actorRole: actor.roles[0] ?? null,
      now,
    });

    const copied = await copyActivities(tx, winnerLeadId, loserLeadId, strategy);
    await tx.leadMerge.update({
      where: { id: mergeRow.id },
      data: { activitiesCopiedCount: copied },
    });

    await tx.duplicateCase.update({
      where: { id: duplicateCaseId },
      data: {
        reviewStatus: DupReviewStatus.MERGED,
        mergeId: mergeRow.id,
        reviewedByUserId: actor.userId,
        reviewedAt: now,
        reviewNotes: reason,
      },
    });

    if (input.throwAfterWrites) {
      throw new Error("forced mid-transaction failure");
    }

    return {
      mergeId: mergeRow.id,
      winnerLeadId,
      loserLeadId,
      transitionId: result.transitionId,
      activitiesCopiedCount: copied,
      auditEntries: result.auditEntries,
    };
  }, LEAD_INTERACTIVE_TX_OPTIONS).then(async (committed) => {
    const { auditPort } = await import("@/lib/leads/application/audit-adapter");
    for (const entry of committed.auditEntries) {
      await auditPort.append({
        actorUserId: actor.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: committed.loserLeadId,
        after: entry.after,
      });
    }
    const { auditEntries: _ignored, ...rest } = committed;
    return rest;
  });
}

export const mergeLoser = mergeDuplicateCase;
