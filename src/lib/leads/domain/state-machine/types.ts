import type { Lead } from "../entities/Lead";
import type {
  AssignmentType,
  FollowUpType,
  LeadActivityType,
  LeadEvent,
  LeadEventType,
  LeadOutcome,
  LeadStatus,
} from "../enums";

export const REACTIVATION_WINDOW_DAYS = 90;

export const TERMINAL_STATUSES: readonly LeadStatus[] = [
  "CONVERTED",
  "EXPIRED_AUTO_PURGED",
];

export const NON_REACTIVATABLE_TERMINAL: readonly LeadStatus[] = [
  "CONVERTED",
  "EXPIRED_AUTO_PURGED",
];

export type LeadPatch = {
  outcome?: LeadOutcome | null;
  isArchived?: boolean;
  archivedAt?: Date | null;
  archivedByUserId?: string | null;
  archiveReason?: string | null;
  assignedTelecallerId?: string | null;
  activeAssignmentId?: string | null;
  convertedDonorId?: string | null;
  convertedRecipientId?: string | null;
  convertedAt?: Date | null;
  convertedByUserId?: string | null;
  mergedIntoLeadId?: string | null;
  redactedAt?: Date | null;
  redactionReason?: string | null;
  doNotCallFlag?: boolean;
  lostReason?: string | null;
  lastActivityAt?: Date;
};

export type DomainWrite =
  | { kind: "lead_patch"; patch: LeadPatch }
  | {
      kind: "status_history";
      fromStatus: LeadStatus | null;
      toStatus: LeadStatus;
      event: LeadEvent;
      reason?: string | null;
      guardsPassed?: unknown;
    }
  | {
      kind: "activity";
      activityType: LeadActivityType;
      summary: string;
      outcome?: string | null;
      metadata?: Record<string, unknown> | null;
    }
  | {
      kind: "outbox";
      eventType: LeadEventType;
      payload: Record<string, unknown>;
      internalOnly?: boolean;
    }
  | {
      kind: "assignment";
      assigneeUserId: string;
      assignmentType: AssignmentType;
      reason?: string | null;
      closePrior?: boolean;
      siteId?: string | null;
    }
  | {
      kind: "score";
      score: number;
      tier: string;
      breakdown: Record<string, unknown>;
      configKey?: string;
      configVersion?: number;
    }
  | {
      kind: "follow_up";
      followUpType: FollowUpType;
      dueAt: Date;
      reason?: string | null;
      completeOpen?: boolean;
    }
  | {
      kind: "call_record";
      startedAt: Date;
      endedAt?: Date | null;
      disposition: string;
      notes?: string | null;
    }
  | { kind: "dnc_add"; reason: string }
  | {
      kind: "counselling_booking";
      counsellorUserId: string;
      scheduledAt: Date;
      mode: string;
      meetingUrl?: string | null;
      meetingLocation?: string | null;
      durationMinutes?: number;
    }
  | {
      kind: "counselling_booking_update";
      bookingStatus: string;
      legacyStatus?: string;
      cancelledReason?: string | null;
    }
  | {
      kind: "counselling_session";
      attendance: string;
      notes?: string | null;
      bookingId?: string | null;
    }
  | {
      kind: "counselling_outcome";
      recommendation: string;
      rationale?: string | null;
    }
  | {
      kind: "conversion_stub";
      target: "DONOR" | "RECIPIENT";
      targetEntityId?: string;
      eligibilitySnapshot?: Record<string, unknown>;
      decidedByUserId?: string;
      notes?: string | null;
    }
  | { kind: "merge_stub"; winnerLeadId: string }
  | { kind: "redact_pii" }
  | { kind: "attribution_first"; source: string };

export type NotificationSpec = {
  templateKey: string;
  recipientUserId?: string | null;
  payload: Record<string, unknown>;
};

export type AuditEntry = {
  action: string;
  entityType: string;
  after: Record<string, unknown>;
};

export type OutboxEventSpec = {
  eventType: LeadEventType;
  payload: Record<string, unknown>;
  internalOnly?: boolean;
};

export type TransitionResult = {
  transitionId: string;
  nextStatus: LeadStatus;
  writes: DomainWrite[];
  notifications: NotificationSpec[];
  auditEntries: AuditEntry[];
  outboxEvents: OutboxEventSpec[];
};

export type GuardFacts = {
  hasConsent: boolean;
  dncBlocked: boolean;
  isOwner: boolean;
  isSupervisor: boolean;
  hasPermission: boolean;
  requiredFieldsPresent: boolean;
  hasConversion: boolean;
  lostAt: Date | null;
  isMerged: boolean;
  counsellorAvailable: boolean;
  attemptCount: number;
  maxAttempts: number;
  configVersionActive: boolean;
  callRecordAttached: boolean;
  dueAtPresent: boolean;
  reasonPresent: boolean;
  bookingExists: boolean;
  bookingInFuture: boolean;
  sessionRecordAttached: boolean;
  personTypeDonor: boolean;
  personTypeRecipient: boolean;
  recommendationRegister: boolean;
  leadMergeExists: boolean;
  retentionExpired: boolean;
  outcomeWon: boolean;
  assigneeAvailable: boolean;
  claimAllowed: boolean;
  publicIntake: boolean;
};

export type TransitionPayload = {
  reason?: string | null;
  assigneeUserId?: string | null;
  siteId?: string | null;
  dueAt?: Date | null;
  callStartedAt?: Date | null;
  callEndedAt?: Date | null;
  notes?: string | null;
  counsellorUserId?: string | null;
  scheduledAt?: Date | null;
  mode?: string | null;
  meetingUrl?: string | null;
  meetingLocation?: string | null;
  durationMinutes?: number | null;
  cancelMode?: "reschedule" | "full" | null;
  winnerLeadId?: string | null;
  recommendation?: string | null;
  score?: number | null;
  scoreTier?: string | null;
  scoreBreakdown?: Record<string, unknown> | null;
  source?: string | null;
  extras?: Record<string, unknown>;
};

export type TransitionActor = {
  userId: string;
  roles: readonly string[];
  siteId?: string | null;
  actorRole?: string | null;
};

export type TransitionContext = {
  now: Date;
  actor: TransitionActor;
  payload: TransitionPayload;
  facts: GuardFacts;
};

export type TransitionFn = (
  currentLead: Lead | null,
  ctx: TransitionContext,
) => TransitionResult;
