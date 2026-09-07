import type { Prisma, PrismaClient } from "@prisma/client";
import {
  AssignmentType,
  BookingStatus,
  CallDispositionType,
  CounsellingBookingStatus,
  DispatchStatus,
  FollowUpPriority,
  FollowUpStatus,
  LeadActivityType,
  LeadChannel,
  LeadEvent,
  LeadEventType,
  LeadOutcome,
  LeadStatus,
  ScoreTrigger,
  SessionAttendance,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import type { Lead } from "../domain/entities/Lead";
import type { ActorContext } from "../domain/ports/shared";
import type { DomainWrite } from "../domain/state-machine/types";
import { LeadDuplicateConversionError, LeadInvariantViolationError } from "../domain/errors";
import {
  LEAD_INTERACTIVE_TX_OPTIONS,
  prismaLeadRepository,
} from "./prisma-lead-repository";
import { leadToDomain } from "./mappers/lead-mapper";
import { activityToDomain } from "./mappers/activity-mapper";
import { statusHistoryToDomain } from "./mappers/status-history-mapper";
import { outboxEventToDomain } from "./mappers/outbox-event-mapper";
import { assignmentToDomain } from "./mappers/assignment-mapper";
import { scoreToDomain } from "./mappers/score-mapper";
import { addDncFromLeadContact } from "../application/dnc";
import { followUpToDomain } from "./mappers/follow-up-mapper";
import type { TransitionStore } from "../application/__apply-transition";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

function toCallDisposition(event: string): CallDispositionType | null {
  const map: Record<string, CallDispositionType> = {
    disposition_qualified: CallDispositionType.CONTACTED_QUALIFIED,
    disposition_not_interested: CallDispositionType.CONTACTED_NOT_INTERESTED,
    disposition_callback: CallDispositionType.CONTACTED_CALLBACK_REQUESTED,
    disposition_not_reachable: CallDispositionType.NOT_REACHABLE,
    disposition_wrong_number: CallDispositionType.WRONG_NUMBER,
    disposition_do_not_call: CallDispositionType.DO_NOT_CALL,
  };
  return map[event] ?? null;
}

async function appendStatusHistory(
  tx: Tx,
  leadId: string,
  write: Extract<DomainWrite, { kind: "status_history" }>,
  actorUserId: string,
  actorRole: string | null,
  now: Date,
): Promise<string> {
  const row = await tx.leadStatusHistory.create({
    data: {
      leadId,
      fromStatus: write.fromStatus as LeadStatus | null,
      toStatus: write.toStatus as LeadStatus,
      event: write.event as LeadEvent,
      guardsPassed: write.guardsPassed as Prisma.InputJsonValue ?? undefined,
      actorUserId,
      actorRole,
      reason: write.reason ?? null,
      occurredAt: now,
    },
  });
  statusHistoryToDomain(row);
  return row.id;
}

async function appendActivity(
  tx: Tx,
  leadId: string,
  write: Extract<DomainWrite, { kind: "activity" }>,
  actorUserId: string,
  actorRole: string | null,
  now: Date,
): Promise<string> {
  const row = await tx.leadActivity.create({
    data: {
      leadId,
      activityType: write.activityType as LeadActivityType,
      channel: LeadChannel.SYSTEM,
      actorUserId,
      actorRole,
      occurredAt: now,
      summary: write.summary,
      outcome: write.outcome ?? null,
      metadata: write.metadata as Prisma.InputJsonValue | undefined,
    },
  });
  activityToDomain(row);
  return row.id;
}

async function appendOutboxEvent(
  tx: Tx,
  leadId: string,
  write: Extract<DomainWrite, { kind: "outbox" }>,
  now: Date,
): Promise<string | null> {
  if (write.internalOnly) return null;
  const row = await tx.leadOutboxEvent.create({
    data: {
      aggregateType: "Lead",
      aggregateId: leadId,
      eventType: write.eventType as LeadEventType,
      eventVersion: 1,
      payload: write.payload as Prisma.InputJsonValue,
      occurredAt: now,
      dispatchStatus: DispatchStatus.PENDING,
    },
  });
  outboxEventToDomain(row);
  return row.id;
}

export class PrismaLeadTransitionStore implements TransitionStore {
  constructor(private readonly db: typeof prisma = prisma) {}

  async load(id: string, ctx?: ActorContext): Promise<Lead | null> {
    return prismaLeadRepository.byId(id, ctx);
  }

  async persistBundle(input: {
    lead: Lead;
    nextStatus: string;
    writes: DomainWrite[];
    actorUserId: string;
    actorRole: string | null;
    now: Date;
    throwAfterWrites?: boolean;
  }): Promise<{ status: string; latestHistoryToStatus: string | null }> {
    return this.db.$transaction(
      (tx) => this.persistBundleWithClient(tx as never, input),
      LEAD_INTERACTIVE_TX_OPTIONS,
    );
  }

  async persistBundleWithClient(
    tx: Tx,
    input: {
      lead: Lead;
      nextStatus: string;
      writes: DomainWrite[];
      actorUserId: string;
      actorRole: string | null;
      now: Date;
      throwAfterWrites?: boolean;
    },
  ): Promise<{ status: string; latestHistoryToStatus: string | null }> {
      const leadId = input.lead.id;
      let patch: Prisma.LeadUncheckedUpdateInput = {
        status: input.nextStatus as LeadStatus,
        version: { increment: 1 },
        lastActivityAt: input.now,
      };

      for (const write of input.writes) {
        if (write.kind === "lead_patch") {
          const p = write.patch;
          patch = {
            ...patch,
            outcome: p.outcome === undefined ? patch.outcome : (p.outcome as LeadOutcome | null),
            isArchived: p.isArchived ?? patch.isArchived,
            archivedAt: p.archivedAt === undefined ? patch.archivedAt : p.archivedAt,
            archivedByUserId: p.archivedByUserId === undefined ? patch.archivedByUserId : p.archivedByUserId,
            archiveReason: p.archiveReason === undefined ? patch.archiveReason : p.archiveReason,
            assignedTelecallerId:
              p.assignedTelecallerId === undefined ? patch.assignedTelecallerId : p.assignedTelecallerId,
            convertedDonorId: p.convertedDonorId === undefined ? patch.convertedDonorId : p.convertedDonorId,
            convertedRecipientId:
              p.convertedRecipientId === undefined ? patch.convertedRecipientId : p.convertedRecipientId,
            convertedAt: p.convertedAt === undefined ? patch.convertedAt : p.convertedAt,
            convertedByUserId:
              p.convertedByUserId === undefined ? patch.convertedByUserId : p.convertedByUserId,
            mergedIntoLeadId: p.mergedIntoLeadId === undefined ? patch.mergedIntoLeadId : p.mergedIntoLeadId,
            redactedAt: p.redactedAt === undefined ? patch.redactedAt : p.redactedAt,
            redactionReason: p.redactionReason === undefined ? patch.redactionReason : p.redactionReason,
            doNotCallFlag: p.doNotCallFlag ?? patch.doNotCallFlag,
            lostReason: p.lostReason === undefined ? patch.lostReason : p.lostReason,
            lastActivityAt: p.lastActivityAt ?? patch.lastActivityAt,
          };
        }
      }

      await tx.lead.update({ where: { id: leadId }, data: patch });

      let latestHistoryToStatus: string | null = null;
      for (const write of input.writes) {
        switch (write.kind) {
          case "status_history": {
            await appendStatusHistory(tx as never, leadId, write, input.actorUserId, input.actorRole, input.now);
            latestHistoryToStatus = write.toStatus;
            break;
          }
          case "activity":
            await appendActivity(tx as never, leadId, write, input.actorUserId, input.actorRole, input.now);
            break;
          case "outbox":
            await appendOutboxEvent(tx as never, leadId, write, input.now);
            break;
          case "assignment": {
            if (write.closePrior) {
              await tx.leadAssignment.updateMany({
                where: { leadId, endedAt: null },
                data: { endedAt: input.now, endReason: write.reason ?? "superseded" },
              });
            }
            const open = await tx.leadAssignment.count({ where: { leadId, endedAt: null } });
            if (open > 0 && !write.closePrior) {
              throw new LeadInvariantViolationError("Only one active assignment allowed", {
                invariant: "I-05",
                leadId,
              });
            }
            if (!write.siteId) break;
            const created = await tx.leadAssignment.create({
              data: {
                leadId,
                assigneeUserId: write.assigneeUserId,
                assignedByUserId: input.actorUserId,
                assignmentType: write.assignmentType as AssignmentType,
                reason: write.reason ?? null,
                startedAt: input.now,
                siteId: write.siteId,
              },
            });
            assignmentToDomain(created);
            await tx.lead.update({
              where: { id: leadId },
              data: { activeAssignmentId: created.id, assignedTelecallerId: write.assigneeUserId, assignedAt: input.now },
            });
            break;
          }
          case "score": {
            const score = await tx.leadScore.create({
              data: {
                leadId,
                score: write.score,
                tier: write.tier as never,
                breakdown: write.breakdown as Prisma.InputJsonValue,
                configKey: write.configKey ?? "SCORE_WEIGHTS_V1",
                configVersion: write.configVersion ?? 1,
                triggerReason: ScoreTrigger.intake,
                computedAt: input.now,
              },
            });
            scoreToDomain(score);
            await tx.lead.update({
              where: { id: leadId },
              data: { latestScoreId: score.id, latestScoreValue: write.score },
            });
            break;
          }
          case "follow_up": {
            if (write.completeOpen) {
              await tx.leadFollowUp.updateMany({
                where: { leadId, status: { in: [FollowUpStatus.OPEN, FollowUpStatus.DUE, FollowUpStatus.OVERDUE] } },
                data: {
                  status: FollowUpStatus.COMPLETED,
                  completedAt: input.now,
                  completedByUserId: input.actorUserId,
                },
              });
              break;
            }
            await tx.leadFollowUp.create({
              data: {
                leadId,
                ownerUserId: input.actorUserId,
                type: write.followUpType as never,
                priority: FollowUpPriority.NORMAL,
                reason: write.reason ?? null,
                dueAt: write.dueAt,
                status: FollowUpStatus.OPEN,
              },
            }).then(followUpToDomain);
            break;
          }
          case "call_record": {
            const disposition = toCallDisposition(write.disposition);
            if (disposition) {
              await tx.callDisposition.create({
                data: {
                  leadId,
                  telecallerId: input.actorUserId,
                  callStartedAt: write.startedAt,
                  callEndedAt: write.endedAt ?? input.now,
                  durationSeconds: write.endedAt
                    ? Math.max(
                        0,
                        Math.round((write.endedAt.getTime() - write.startedAt.getTime()) / 1000),
                      )
                    : null,
                  disposition,
                  notes: write.notes ?? null,
                },
              });
            }
            break;
          }
          case "dnc_add": {
            const row = await tx.lead.findUnique({ where: { id: leadId }, select: { phone: true, email: true } });
            if (row?.phone) {
              await addDncFromLeadContact(
                {
                  phone: row.phone,
                  email: row.email,
                  reason: write.reason,
                  createdByUserId: input.actorUserId,
                  sourceLeadId: leadId,
                },
                tx as never,
              );
            }
            break;
          }
          case "counselling_booking":
            await tx.counsellingBooking.upsert({
              where: { leadId },
              create: {
                leadId,
                counsellorUserId: write.counsellorUserId,
                scheduledAt: write.scheduledAt,
                mode: write.mode as never,
                meetingUrl: write.meetingUrl ?? null,
                meetingLocation: write.meetingLocation ?? null,
                durationMinutes: write.durationMinutes ?? 30,
                status: CounsellingBookingStatus.BOOKED,
                bookingStatus: BookingStatus.SCHEDULED,
              },
              update: {
                counsellorUserId: write.counsellorUserId,
                scheduledAt: write.scheduledAt,
                mode: write.mode as never,
                meetingUrl: write.meetingUrl ?? null,
                meetingLocation: write.meetingLocation ?? null,
                durationMinutes: write.durationMinutes ?? 30,
                status: CounsellingBookingStatus.BOOKED,
                bookingStatus: BookingStatus.SCHEDULED,
                cancelledAt: null,
                cancelledReason: null,
              },
            });
            break;
          case "counselling_booking_update": {
            const booking = await tx.counsellingBooking.findUnique({ where: { leadId } });
            if (booking) {
              await tx.counsellingBooking.update({
                where: { id: booking.id },
                data: {
                  bookingStatus: write.bookingStatus as BookingStatus,
                  status: (write.legacyStatus as CounsellingBookingStatus | undefined) ?? booking.status,
                  cancelledReason: write.cancelledReason ?? undefined,
                  cancelledAt: write.bookingStatus === "CANCELLED" ? input.now : undefined,
                  cancelledByUserId: write.bookingStatus === "CANCELLED" ? input.actorUserId : undefined,
                  attendedAt: write.legacyStatus === "ATTENDED" ? input.now : undefined,
                },
              });
            }
            break;
          }
          case "counselling_session": {
            const booking = await tx.counsellingBooking.findUnique({ where: { leadId } });
            if (booking) {
              await tx.counsellingSession.create({
                data: {
                  bookingId: booking.id,
                  leadId,
                  counsellorUserId: booking.counsellorUserId,
                  attendanceStatus: write.attendance as SessionAttendance,
                  notes: write.notes ?? null,
                  recordedByUserId: input.actorUserId,
                  recordedAt: input.now,
                },
              });
            }
            break;
          }
          case "counselling_outcome": {
            const session = await tx.counsellingSession.findFirst({
              where: { leadId },
              orderBy: { recordedAt: "desc" },
            });
            if (session) {
              await tx.counsellingOutcome.create({
                data: {
                  sessionId: session.id,
                  leadId,
                  recommendation: write.recommendation as never,
                  recommendedByUserId: input.actorUserId,
                  rationale: write.rationale ?? null,
                },
              });
            }
            break;
          }
          case "conversion_stub": {
            if (!write.targetEntityId) break;
            try {
              await tx.leadConversion.create({
                data: {
                  leadId,
                  targetType: write.target,
                  targetEntityId: write.targetEntityId,
                  decidedByUserId: write.decidedByUserId ?? input.actorUserId,
                  eligibilitySnapshot: (write.eligibilitySnapshot ?? {}) as Prisma.InputJsonValue,
                  occurredAt: input.now,
                  notes: write.notes ?? null,
                },
              });
            } catch (err) {
              if (
                typeof err === "object" &&
                err &&
                "code" in err &&
                (err as { code: string }).code === "P2002"
              ) {
                throw new LeadDuplicateConversionError("Lead already converted", {
                  leadId,
                  code: "DUPLICATE_CONVERSION",
                });
              }
              throw err;
            }
            break;
          }
          case "merge_stub":
            break;
          case "redact_pii":
            await tx.lead.update({
              where: { id: leadId },
              data: {
                fullName: null,
                phone: null,
                email: null,
                city: null,
                state: null,
                pincode: null,
                consentIp: null,
                consentUserAgent: null,
              },
            });
            break;
          case "attribution_first": {
            const existing = await tx.leadAttribution.findUnique({ where: { leadId } });
            if (!existing) {
              await tx.leadAttribution.create({
                data: {
                  leadId,
                  firstTouchAt: input.now,
                  firstTouchSource: write.source as never,
                  lastTouchAt: input.now,
                  lastTouchSource: write.source as never,
                },
              });
              await tx.leadAttributionHistory.create({
                data: {
                  leadId,
                  touchAt: input.now,
                  source: write.source as never,
                  touchType: "FIRST",
                  capturedAt: input.now,
                },
              });
            }
            break;
          }
          default:
            break;
        }
      }

      if (input.throwAfterWrites) {
        throw new Error("mid-transition failure");
      }

      const history = await tx.leadStatusHistory.findFirst({
        where: { leadId },
        orderBy: { occurredAt: "desc" },
      });
      const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
      const domainLead = leadToDomain({
        ...lead,
        counsellingBooking: null,
        assignedTelecaller: null,
      });
      return {
        status: domainLead.status,
        latestHistoryToStatus: history?.toStatus ?? latestHistoryToStatus,
      };
  }
}

export const prismaTransitionStore = new PrismaLeadTransitionStore();

export const prismaLeadWriteHelpers = {
  appendActivity,
  appendStatusHistory,
  appendOutboxEvent,
};
