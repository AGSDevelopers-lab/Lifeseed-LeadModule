import { describe, expect, it } from "vitest";

import { aCampaign } from "../../testing/fixtures/aCampaign";
import { aCounsellingBooking } from "../../testing/fixtures/aCounsellingBooking";
import { Lead } from "../../domain/entities/Lead";
import type { LeadActivity } from "../../domain/entities/LeadActivity";
import type { LeadAssignment } from "../../domain/entities/LeadAssignment";
import type { LeadAttribution } from "../../domain/entities/LeadAttribution";
import type { LeadConfig } from "../../domain/entities/LeadConfig";
import type { LeadConversion } from "../../domain/entities/LeadConversion";
import type { CounsellingOutcome } from "../../domain/entities/CounsellingOutcome";
import type { CounsellingSession } from "../../domain/entities/CounsellingSession";
import type { DuplicateCase } from "../../domain/entities/DuplicateCase";
import type { LeadDoNotCall } from "../../domain/entities/LeadDoNotCall";
import type { LeadFollowUp } from "../../domain/entities/LeadFollowUp";
import type { LeadMerge } from "../../domain/entities/LeadMerge";
import type { NotificationDeliveryLog } from "../../domain/entities/NotificationDeliveryLog";
import type { NotificationTemplate } from "../../domain/entities/NotificationTemplate";
import type { LeadOutboxEvent } from "../../domain/entities/LeadOutboxEvent";
import type { LeadScore } from "../../domain/entities/LeadScore";
import type { LeadStatusHistory } from "../../domain/entities/LeadStatusHistory";
import {
  AssignmentType,
  ConversionTarget,
  CounsellingRecommendation,
  DeliveryStatus,
  DispatchStatus,
  DncChannel,
  DncSource,
  DupReviewStatus,
  FollowUpPriority,
  FollowUpStatus,
  FollowUpType,
  LeadActivityType,
  LeadChannel,
  LeadEvent,
  LeadEventType,
  LeadLanguage,
  LeadOutcome,
  LeadPersonType,
  LeadSource,
  LeadStatus,
  LeadTier,
  MatchLevel,
  MergeCopyStrategy,
  NotificationChannel,
  NotificationProvider,
  ScoreTrigger,
  SessionAttendance,
} from "../../domain/enums";
import { ArchiveMeta } from "../../domain/value-objects/ArchiveMeta";
import { AttributionTouch } from "../../domain/value-objects/AttributionTouch";
import { Consent } from "../../domain/value-objects/Consent";
import { ContactInfo } from "../../domain/value-objects/ContactInfo";
import { LeadCode } from "../../domain/value-objects/LeadCode";
import { TierScore } from "../../domain/value-objects/TierScore";
import { comparable } from "./comparable";
import { activityToDomain, activityToPrisma } from "./activity-mapper";
import { assignmentToDomain, assignmentToPrisma } from "./assignment-mapper";
import { attributionToDomain, attributionToPrisma } from "./attribution-mapper";
import { campaignToDomain, campaignToPrisma } from "./campaign-mapper";
import { configToDomain, configToPrisma } from "./config-mapper";
import { conversionToDomain, conversionToPrisma } from "./conversion-mapper";
import {
  counsellingBookingToDomain,
  counsellingBookingToPrisma,
} from "./counselling-booking-mapper";
import {
  counsellingOutcomeToDomain,
  counsellingOutcomeToPrisma,
} from "./counselling-outcome-mapper";
import {
  counsellingSessionToDomain,
  counsellingSessionToPrisma,
} from "./counselling-session-mapper";
import { dncToDomain, dncToPrisma } from "./dnc-mapper";
import { duplicateCaseToDomain, duplicateCaseToPrisma } from "./duplicate-case-mapper";
import { followUpToDomain, followUpToPrisma } from "./follow-up-mapper";
import { leadToDomain, leadToPrisma } from "./lead-mapper";
import { mergeToDomain, mergeToPrisma } from "./merge-mapper";
import {
  notificationDeliveryLogToDomain,
  notificationDeliveryLogToPrisma,
} from "./notification-delivery-log-mapper";
import {
  notificationTemplateToDomain,
  notificationTemplateToPrisma,
} from "./notification-template-mapper";
import { outboxEventToDomain, outboxEventToPrisma } from "./outbox-event-mapper";
import { scoreToDomain, scoreToPrisma } from "./score-mapper";
import { statusHistoryToDomain, statusHistoryToPrisma } from "./status-history-mapper";

const capturedAt = new Date("2026-09-04T00:00:00.000Z");

function expectRoundTrip<T>(
  entity: T,
  toPrismaFn: (e: T) => unknown,
  toDomainFn: (p: never) => T,
) {
  const back = toDomainFn(toPrismaFn(entity) as never);
  expect(comparable(back)).toEqual(comparable(entity));
}

function aMappedLead(): Lead {
  return new Lead({
    id: "lead_rt",
    code: LeadCode.parse("LED-KOL-20260904-0001"),
    personType: LeadPersonType.DONOR,
    donorSubtype: "SEMEN",
    contact: new ContactInfo(
      "Round Trip",
      "9999999999",
      "rt@example.com",
      "Kolkata",
      "WB",
      "700001",
      "English",
    ),
    consent: new Consent(true, false, true, "lead-v1.0", "127.0.0.1", "vitest"),
    status: LeadStatus.ASSIGNED,
    outcome: LeadOutcome.WON,
    isArchived: true,
    archive: new ArchiveMeta(capturedAt, "user_arch", "test archive"),
    source: LeadSource.WEB_FORM,
    latestScore: new TierScore(72, LeadTier.WARM, "score_rt", capturedAt),
    latestScoreId: "score_rt",
    ownership: {
      siteId: "site-kol",
      assignedTelecallerId: "tele_1",
      activeAssignmentId: "asg_1",
    },
    retention: {
      capturedAt,
      retentionExpiresAt: new Date("2027-09-04T00:00:00.000Z"),
    },
    merge: { mergedIntoLeadId: "lead_winner" },
    conversion: {
      convertedDonorId: "donor_1",
      convertedRecipientId: null,
      convertedAt: capturedAt,
    },
    duplicate: { duplicateOfLeadId: "lead_orig" },
    version: 4,
  });
}

const activity: LeadActivity = {
  id: "act_1",
  leadId: "lead_rt",
  activityType: LeadActivityType.STATUS_CHANGE,
  channel: LeadChannel.SYSTEM,
  actorUserId: "user_1",
  actorRole: "TELECALLER",
  occurredAt: capturedAt,
  summary: "Assigned",
  outcome: "ASSIGNED",
  nextAction: "Call",
  nextActionDueAt: capturedAt,
  metadata: { transitionId: "T-02" },
  relatedEntityType: "LeadAssignment",
  relatedEntityId: "asg_1",
  auditRef: "aud_1",
  createdAt: capturedAt,
};

const followUp: LeadFollowUp = {
  id: "fu_1",
  leadId: "lead_rt",
  ownerUserId: "tele_1",
  type: FollowUpType.CALLBACK,
  priority: FollowUpPriority.HIGH,
  reason: "Callback requested",
  dueAt: capturedAt,
  status: FollowUpStatus.OPEN,
  completedAt: null,
  completedByUserId: null,
  outcome: null,
  nextFollowUpId: null,
  rescheduledFromId: "fu_0",
  cancelReason: null,
  slaScheduleId: "sla_1",
  createdAt: capturedAt,
  updatedAt: capturedAt,
};

const assignment: LeadAssignment = {
  id: "asg_1",
  leadId: "lead_rt",
  assigneeUserId: "tele_1",
  assignedByUserId: "ops_1",
  assignmentType: AssignmentType.MANUAL,
  reason: "skill match",
  startedAt: capturedAt,
  endedAt: null,
  endReason: null,
  siteId: "site-kol",
  metadata: { shift: "AM" },
};

const score: LeadScore = {
  id: "score_rt",
  leadId: "lead_rt",
  score: 72,
  tier: LeadTier.WARM,
  breakdown: { phone: 20, source: 10 },
  configKey: "SCORE_WEIGHTS_V1",
  configVersion: 1,
  triggerReason: ScoreTrigger.intake,
  computedByUserId: "system",
  computedAt: capturedAt,
  notes: "intake",
};

const history: LeadStatusHistory = {
  id: "hist_1",
  leadId: "lead_rt",
  fromStatus: LeadStatus.NEW,
  toStatus: LeadStatus.ASSIGNED,
  event: LeadEvent.assign,
  guardsPassed: { hasConsent: true },
  actorUserId: "ops_1",
  actorRole: "OPS_MANAGER",
  reason: "manual assign",
  occurredAt: capturedAt,
  outboxEventId: "obx_1",
  auditRef: "aud_2",
};

const session: CounsellingSession = {
  id: "sess_1",
  bookingId: "book_1",
  leadId: "lead_rt",
  counsellorUserId: "user_c",
  startedAt: capturedAt,
  endedAt: capturedAt,
  attendanceStatus: SessionAttendance.ATTENDED,
  notes: "Good session",
  recordedByUserId: "user_c",
  recordedAt: capturedAt,
};

const outcome: CounsellingOutcome = {
  id: "out_1",
  sessionId: "sess_1",
  leadId: "lead_rt",
  recommendation: CounsellingRecommendation.RECOMMEND_REGISTER,
  recommendedByUserId: "user_c",
  rationale: "Eligible",
  nextActionType: "CONVERT",
  nextActionAt: capturedAt,
  createdAt: capturedAt,
};

const attribution: LeadAttribution = {
  id: "attr_1",
  leadId: "lead_rt",
  firstTouch: new AttributionTouch(
    capturedAt,
    LeadSource.WEB_FORM,
    "camp_1",
    "cpc",
    "paid",
    "creative_a",
    "https://example.test/l",
    "partner_1",
    { utm_source: "google" },
  ),
  lastTouch: new AttributionTouch(
    capturedAt,
    LeadSource.WHATSAPP_BOT,
    "camp_2",
    "chat",
    "organic",
    "creative_b",
    "https://example.test/w",
    null,
    { utm_source: "wa" },
  ),
  createdAt: capturedAt,
  updatedAt: capturedAt,
};

const dup: DuplicateCase = {
  id: "dup_1",
  leftLeadId: "lead_rt",
  rightLeadId: "lead_2",
  matchLevel: MatchLevel.EXACT,
  matchSignals: { phone: true },
  matchScore: 100,
  detectedAt: capturedAt,
  reviewStatus: DupReviewStatus.OPEN,
  reviewedByUserId: "ops_1",
  reviewedAt: capturedAt,
  reviewNotes: "same phone",
  mergeId: "merge_1",
  createdAt: capturedAt,
  updatedAt: capturedAt,
};

const merge: LeadMerge = {
  id: "merge_1",
  duplicateCaseId: "dup_1",
  winnerLeadId: "lead_rt",
  loserLeadId: "lead_2",
  decidedByUserId: "ops_1",
  reason: "exact phone",
  activityCopyStrategy: MergeCopyStrategy.COPY_ALL,
  activitiesCopiedCount: 3,
  mergedAt: capturedAt,
  auditRef: "aud_3",
};

const dnc: LeadDoNotCall = {
  id: "dnc_1",
  phone: "9999999999",
  email: "rt@example.com",
  reason: "requested",
  addedByUserId: "ops_1",
  addedAt: capturedAt,
  expiresAt: capturedAt,
  source: DncSource.OPS_ADD,
  channel: DncChannel.PHONE,
  value: "+919999999999",
  normalisedValue: "+919999999999",
  sourceLeadId: null,
  effectiveFrom: capturedAt,
  effectiveUntil: capturedAt,
  createdByUserId: "ops_1",
  removalAuthorityUserId: null,
  removedAt: null,
  removalNote: null,
  createdAt: capturedAt,
  updatedAt: capturedAt,
};

const conversion: LeadConversion = {
  id: "conv_1",
  leadId: "lead_rt",
  targetType: ConversionTarget.DONOR,
  targetEntityId: "donor_1",
  decidedByUserId: "ops_1",
  eligibilitySnapshot: { eligible: true },
  outboxEventId: "obx_2",
  occurredAt: capturedAt,
  notes: "converted",
};

const config: LeadConfig = {
  id: "cfg_1",
  key: "SCORE_WEIGHTS_V1",
  version: 2,
  payload: { phone: 20 },
  payloadSchemaRef: "score-weights/v1",
  ownerRole: "OPS_MANAGER",
  createdByUserId: "ops_1",
  createdAt: capturedAt,
  approvedByUserId: "admin_1",
  approvedAt: capturedAt,
  effectiveFrom: capturedAt,
  effectiveUntil: null,
  isActive: true,
  notes: "v2",
};

const outbox: LeadOutboxEvent = {
  id: "obx_1",
  aggregateType: "Lead",
  aggregateId: "lead_rt",
  eventType: LeadEventType.LeadAssigned,
  eventVersion: 1,
  payload: { assigneeUserId: "tele_1" },
  occurredAt: capturedAt,
  enqueuedAt: capturedAt,
  publishedAt: capturedAt,
  dispatchStatus: DispatchStatus.PUBLISHED,
  attemptCount: 1,
  lastAttemptAt: capturedAt,
  lastAttemptError: null,
  lockedUntil: null,
  lockedByWorkerId: "worker_1",
};

const template: NotificationTemplate = {
  id: "tpl_1",
  key: "intake_welcome",
  channel: NotificationChannel.WHATSAPP,
  provider: NotificationProvider.META_WHATSAPP,
  subject: null,
  body: "Welcome {{name}}",
  variables: ["name"],
  language: LeadLanguage.ENGLISH,
  version: 1,
  isActive: true,
  approvedByUserId: "admin_1",
  approvedAt: capturedAt,
  createdAt: capturedAt,
  updatedAt: capturedAt,
};

const delivery: NotificationDeliveryLog = {
  id: "ndl_1",
  leadId: "lead_rt",
  templateId: "tpl_1",
  channel: NotificationChannel.WHATSAPP,
  provider: NotificationProvider.META_WHATSAPP,
  recipient: "9999999999",
  sentAt: capturedAt,
  providerMessageId: "wamid_1",
  deliveryStatus: DeliveryStatus.DELIVERED,
  statusUpdatedAt: capturedAt,
  failureReason: null,
  dncCheckedAt: capturedAt,
  dncPassed: true,
  payloadHash: "abc",
};

describe("Prisma↔Domain mapper round-trips", () => {
  it("lead", () => expectRoundTrip(aMappedLead(), leadToPrisma, leadToDomain));
  it("activity", () => expectRoundTrip(activity, activityToPrisma, activityToDomain));
  it("follow-up", () => expectRoundTrip(followUp, followUpToPrisma, followUpToDomain));
  it("assignment", () => expectRoundTrip(assignment, assignmentToPrisma, assignmentToDomain));
  it("score", () => expectRoundTrip(score, scoreToPrisma, scoreToDomain));
  it("status-history", () =>
    expectRoundTrip(history, statusHistoryToPrisma, statusHistoryToDomain));
  it("counselling-booking", () =>
    expectRoundTrip(aCounsellingBooking(), counsellingBookingToPrisma, counsellingBookingToDomain));
  it("counselling-session", () =>
    expectRoundTrip(session, counsellingSessionToPrisma, counsellingSessionToDomain));
  it("counselling-outcome", () =>
    expectRoundTrip(outcome, counsellingOutcomeToPrisma, counsellingOutcomeToDomain));
  it("campaign", () =>
    expectRoundTrip(aCampaign(), campaignToPrisma, campaignToDomain));
  it("attribution", () =>
    expectRoundTrip(attribution, attributionToPrisma, attributionToDomain));
  it("duplicate-case", () =>
    expectRoundTrip(dup, duplicateCaseToPrisma, duplicateCaseToDomain));
  it("merge", () => expectRoundTrip(merge, mergeToPrisma, mergeToDomain));
  it("dnc", () => expectRoundTrip(dnc, dncToPrisma, dncToDomain));
  it("conversion", () =>
    expectRoundTrip(conversion, conversionToPrisma, conversionToDomain));
  it("config", () => expectRoundTrip(config, configToPrisma, configToDomain));
  it("outbox-event", () =>
    expectRoundTrip(outbox, outboxEventToPrisma, outboxEventToDomain));
  it("notification-template", () =>
    expectRoundTrip(template, notificationTemplateToPrisma, notificationTemplateToDomain));
  it("notification-delivery-log", () =>
    expectRoundTrip(delivery, notificationDeliveryLogToPrisma, notificationDeliveryLogToDomain));
});
