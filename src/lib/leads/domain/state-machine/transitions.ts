import type { Lead } from "../entities/Lead";
import {
  LeadActivityType,
  LeadEvent,
  LeadEventType,
  LeadOutcome,
  LeadStatus,
  type LeadEvent as LeadEventName,
} from "../enums";
import { LeadStateTransitionNotAllowedError } from "../errors";
import { evaluateGuards, type GuardName } from "./guards";
import { assertI02Terminal, assertTransitionInvariants } from "./invariants";
import type { StateMachineEvent } from "./events";
import type {
  AuditEntry,
  DomainWrite,
  NotificationSpec,
  OutboxEventSpec,
  TransitionContext,
  TransitionFn,
  TransitionResult,
} from "./types";
import { NON_REACTIVATABLE_TERMINAL } from "./types";

const WORKING_NON_TERMINAL: readonly LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.ASSIGNED,
  LeadStatus.CONTACTED_QUALIFIED,
  LeadStatus.CONTACTED_NOT_INTERESTED,
  LeadStatus.CONTACTED_CALLBACK_REQUESTED,
  LeadStatus.NOT_REACHABLE,
  LeadStatus.WRONG_NUMBER,
  LeadStatus.DO_NOT_CALL,
  LeadStatus.COUNSELLING_BOOKED,
  LeadStatus.COUNSELLING_ATTENDED,
  LeadStatus.COUNSELLING_NO_SHOW,
];

function history(
  from: LeadStatus | null,
  to: LeadStatus,
  event: LeadEventName,
  ctx: TransitionContext,
  guards: readonly GuardName[],
): DomainWrite {
  return {
    kind: "status_history",
    fromStatus: from,
    toStatus: to,
    event,
    reason: ctx.payload.reason ?? null,
    guardsPassed: [...guards],
  };
}

function statusActivity(from: LeadStatus | null, to: LeadStatus, event: string, reason?: string | null): DomainWrite {
  return {
    kind: "activity",
    activityType: LeadActivityType.STATUS_CHANGE,
    summary: `${from ?? "∅"} → ${to} (${event})`,
    metadata: { event, reason: reason ?? null },
  };
}

function audit(action: string, after: Record<string, unknown>): AuditEntry {
  return { action, entityType: "Lead", after };
}

function pack(args: {
  id: string;
  nextStatus: LeadStatus;
  writes: DomainWrite[];
  auditEntries: AuditEntry[];
  outboxEvents?: OutboxEventSpec[];
  notifications?: NotificationSpec[];
}): TransitionResult {
  const outboxWrites: DomainWrite[] = (args.outboxEvents ?? []).map((o) => ({
    kind: "outbox" as const,
    eventType: o.eventType,
    payload: o.payload,
    internalOnly: o.internalOnly,
  }));
  const result: TransitionResult = {
    transitionId: args.id,
    nextStatus: args.nextStatus,
    writes: [...args.writes, ...outboxWrites],
    notifications: args.notifications ?? [],
    auditEntries: args.auditEntries,
    outboxEvents: args.outboxEvents ?? [],
  };
  assertTransitionInvariants(result);
  return result;
}

function requireLead(lead: Lead | null, event: string): Lead {
  if (!lead) {
    throw new LeadStateTransitionNotAllowedError("Lead is required for this event", { event });
  }
  return lead;
}

function assertFrom(lead: Lead, allowed: readonly LeadStatus[], event: string): void {
  if (NON_REACTIVATABLE_TERMINAL.includes(lead.status)) {
    assertI02Terminal(lead.status, event);
  }
  if (!allowed.includes(lead.status)) {
    throw new LeadStateTransitionNotAllowedError("STATE_TRANSITION_NOT_ALLOWED", {
      fromStatus: lead.status,
      event,
      allowed,
    });
  }
}

function assertNonTerminal(lead: Lead, event: string): void {
  if (lead.status === LeadStatus.LOST || NON_REACTIVATABLE_TERMINAL.includes(lead.status)) {
    throw new LeadStateTransitionNotAllowedError("STATE_TRANSITION_NOT_ALLOWED", {
      fromStatus: lead.status,
      event,
    });
  }
}

function callRecord(ctx: TransitionContext, disposition: string): DomainWrite {
  return {
    kind: "call_record",
    startedAt: ctx.payload.callStartedAt ?? ctx.now,
    endedAt: ctx.payload.callEndedAt ?? ctx.now,
    disposition,
    notes: ctx.payload.notes ?? null,
  };
}

export const t01Intake: TransitionFn = (lead, ctx) => {
  if (lead) {
    throw new LeadStateTransitionNotAllowedError("Intake requires no existing lead", {
      event: LeadEvent.intake,
    });
  }
  const guards = evaluateGuards(
    ["hasConsent", "notInDnc", "hasRequiredFields", "configVersionActive", "permissionCheck"],
    lead,
    ctx,
  );
  const to = LeadStatus.NEW;
  return pack({
    id: "T-01",
    nextStatus: to,
    writes: [
      history(null, to, LeadEvent.intake, ctx, guards),
      statusActivity(null, to, LeadEvent.intake, ctx.payload.reason),
      { kind: "activity", activityType: LeadActivityType.SYSTEM, summary: "Lead intake" },
      {
        kind: "score",
        score: ctx.payload.score ?? 0,
        tier: ctx.payload.scoreTier ?? "COLD",
        breakdown: ctx.payload.scoreBreakdown ?? {},
      },
      { kind: "attribution_first", source: ctx.payload.source ?? "WEB_FORM" },
    ],
    auditEntries: [audit("lead.intake", { to })],
    outboxEvents: [{ eventType: LeadEventType.LeadCreated, payload: { status: to } }],
  });
};

export const t02Assign: TransitionFn = (current, ctx) => {
  const lead = requireLead(current, LeadEvent.assign);
  assertFrom(lead, [LeadStatus.NEW], LeadEvent.assign);
  const guards = evaluateGuards(["permissionCheck", "assigneeAvailable"], lead, ctx);
  const to = LeadStatus.ASSIGNED;
  const assignee = ctx.payload.assigneeUserId ?? ctx.actor.userId;
  return pack({
    id: "T-02",
    nextStatus: to,
    writes: [
      { kind: "lead_patch", patch: { assignedTelecallerId: assignee, lastActivityAt: ctx.now } },
      {
        kind: "assignment",
        assigneeUserId: assignee,
        assignmentType: "AUTO_ROUND_ROBIN",
        siteId: ctx.payload.siteId ?? ctx.actor.siteId,
      },
      { kind: "activity", activityType: LeadActivityType.ASSIGNMENT, summary: `Assigned to ${assignee}` },
      history(lead.status, to, LeadEvent.assign, ctx, guards),
      statusActivity(lead.status, to, LeadEvent.assign, ctx.payload.reason),
    ],
    auditEntries: [audit("lead.assign", { to, assignee })],
    outboxEvents: [{ eventType: LeadEventType.LeadAssigned, payload: { assigneeUserId: assignee } }],
  });
};

export const t03Reassign: TransitionFn = (current, ctx) => {
  const lead = requireLead(current, LeadEvent.reassign);
  assertFrom(lead, [LeadStatus.ASSIGNED], LeadEvent.reassign);
  const guards = evaluateGuards(
    ["permissionCheck", "assigneeAvailable", "reasonSupplied"],
    lead,
    ctx,
  );
  const to = LeadStatus.ASSIGNED;
  const assignee = ctx.payload.assigneeUserId ?? "";
  return pack({
    id: "T-03",
    nextStatus: to,
    writes: [
      { kind: "lead_patch", patch: { assignedTelecallerId: assignee, lastActivityAt: ctx.now } },
      {
        kind: "assignment",
        assigneeUserId: assignee,
        assignmentType: "REASSIGN",
        reason: ctx.payload.reason ?? null,
        closePrior: true,
        siteId: ctx.payload.siteId ?? ctx.actor.siteId,
      },
      { kind: "activity", activityType: LeadActivityType.ASSIGNMENT, summary: `Reassigned to ${assignee}` },
      history(lead.status, to, LeadEvent.reassign, ctx, guards),
      statusActivity(lead.status, to, LeadEvent.reassign, ctx.payload.reason),
    ],
    auditEntries: [audit("lead.reassign", { to, assignee })],
    outboxEvents: [{ eventType: LeadEventType.LeadAssigned, payload: { assigneeUserId: assignee, reassign: true } }],
  });
};

export const t04Claim: TransitionFn = (current, ctx) => {
  const lead = requireLead(current, LeadEvent.claim);
  assertFrom(lead, [LeadStatus.ASSIGNED], LeadEvent.claim);
  const guards = evaluateGuards(["permissionCheck", "claimAllowed"], lead, ctx);
  const to = LeadStatus.ASSIGNED;
  const assignee = ctx.actor.userId;
  return pack({
    id: "T-04",
    nextStatus: to,
    writes: [
      { kind: "lead_patch", patch: { assignedTelecallerId: assignee, lastActivityAt: ctx.now } },
      {
        kind: "assignment",
        assigneeUserId: assignee,
        assignmentType: "CLAIM",
        closePrior: true,
        siteId: ctx.payload.siteId ?? ctx.actor.siteId,
      },
      { kind: "activity", activityType: LeadActivityType.ASSIGNMENT, summary: `Claimed by ${assignee}` },
      history(lead.status, to, LeadEvent.claim, ctx, guards),
      statusActivity(lead.status, to, LeadEvent.claim, ctx.payload.reason),
    ],
    auditEntries: [audit("lead.claim", { to, assignee })],
    outboxEvents: [{ eventType: LeadEventType.LeadAssigned, payload: { assigneeUserId: assignee, claim: true } }],
  });
};

function dispositionTransition(args: {
  id: string;
  event: LeadEventName;
  from: readonly LeadStatus[];
  to: LeadStatus;
  extraGuards?: GuardName[];
  extraWrites?: (lead: Lead, ctx: TransitionContext) => DomainWrite[];
  outbox: OutboxEventSpec[];
}): TransitionFn {
  return (current, ctx) => {
    const lead = requireLead(current, args.event);
    assertFrom(lead, args.from, args.event);
    const guards = evaluateGuards(
      ["permissionCheck", "ownershipCheck", ...(args.extraGuards ?? [])],
      lead,
      ctx,
    );
    const extra = args.extraWrites?.(lead, ctx) ?? [];
    return pack({
      id: args.id,
      nextStatus: args.to,
      writes: [
        { kind: "lead_patch", patch: { lastActivityAt: ctx.now } },
        callRecord(ctx, args.event),
        { kind: "activity", activityType: LeadActivityType.CALL, summary: args.event },
        ...extra,
        history(lead.status, args.to, args.event, ctx, guards),
        statusActivity(lead.status, args.to, args.event, ctx.payload.reason),
      ],
      auditEntries: [audit("lead.disposition", { to: args.to, event: args.event })],
      outboxEvents: args.outbox,
    });
  };
}

export const t05DispositionQualified = dispositionTransition({
  id: "T-05",
  event: LeadEvent.disposition_qualified,
  from: [LeadStatus.ASSIGNED],
  to: LeadStatus.CONTACTED_QUALIFIED,
  extraGuards: ["callRecordAttached"],
  outbox: [
    { eventType: LeadEventType.LeadContacted, payload: {} },
    { eventType: LeadEventType.LeadQualified, payload: {} },
  ],
});

export const t06DispositionNotInterested = dispositionTransition({
  id: "T-06",
  event: LeadEvent.disposition_not_interested,
  from: [LeadStatus.ASSIGNED],
  to: LeadStatus.CONTACTED_NOT_INTERESTED,
  outbox: [{ eventType: LeadEventType.LeadContacted, payload: {} }],
});

export const t07DispositionCallback = dispositionTransition({
  id: "T-07",
  event: LeadEvent.disposition_callback,
  from: [LeadStatus.ASSIGNED],
  to: LeadStatus.CONTACTED_CALLBACK_REQUESTED,
  extraGuards: ["dueAtSupplied"],
  extraWrites: (_lead, ctx) => [
    {
      kind: "follow_up",
      followUpType: "CALLBACK",
      dueAt: ctx.payload.dueAt ?? ctx.now,
      reason: ctx.payload.reason ?? ctx.payload.notes ?? null,
    },
  ],
  outbox: [
    { eventType: LeadEventType.LeadContacted, payload: {} },
    { eventType: LeadEventType.LeadFollowUpCreated, payload: {} },
  ],
});

export const t08DispositionNotReachable = dispositionTransition({
  id: "T-08",
  event: LeadEvent.disposition_not_reachable,
  from: [LeadStatus.ASSIGNED],
  to: LeadStatus.NOT_REACHABLE,
  extraGuards: ["attemptsRemaining"],
  outbox: [{ eventType: LeadEventType.LeadContacted, payload: {} }],
});

export const t09DispositionWrongNumber = dispositionTransition({
  id: "T-09",
  event: LeadEvent.disposition_wrong_number,
  from: [LeadStatus.ASSIGNED],
  to: LeadStatus.WRONG_NUMBER,
  outbox: [{ eventType: LeadEventType.LeadContacted, payload: {} }],
});

export const t10DispositionDoNotCall = dispositionTransition({
  id: "T-10",
  event: LeadEvent.disposition_do_not_call,
  from: [LeadStatus.ASSIGNED],
  to: LeadStatus.DO_NOT_CALL,
  extraWrites: () => [
    { kind: "dnc_add", reason: "Disposition DO_NOT_CALL" },
    { kind: "activity", activityType: LeadActivityType.DNC, summary: "Added to DNC" },
    { kind: "lead_patch", patch: { doNotCallFlag: true } },
  ],
  outbox: [
    { eventType: LeadEventType.LeadContacted, payload: {} },
    { eventType: LeadEventType.LeadDncAdded, payload: {} },
  ],
});

export const t11CallbackQualified = dispositionTransition({
  id: "T-11",
  event: LeadEvent.disposition_qualified,
  from: [LeadStatus.CONTACTED_CALLBACK_REQUESTED],
  to: LeadStatus.CONTACTED_QUALIFIED,
  extraWrites: () => [{ kind: "follow_up", followUpType: "CALLBACK", dueAt: new Date(0), completeOpen: true }],
  outbox: [
    { eventType: LeadEventType.LeadQualified, payload: {} },
    { eventType: LeadEventType.LeadFollowUpCompleted, payload: {} },
  ],
});

export const t12CallbackNotInterested = dispositionTransition({
  id: "T-12",
  event: LeadEvent.disposition_not_interested,
  from: [LeadStatus.CONTACTED_CALLBACK_REQUESTED],
  to: LeadStatus.CONTACTED_NOT_INTERESTED,
  extraWrites: () => [{ kind: "follow_up", followUpType: "CALLBACK", dueAt: new Date(0), completeOpen: true }],
  outbox: [{ eventType: LeadEventType.LeadContacted, payload: {} }],
});

export const t13NotReachableQualified = dispositionTransition({
  id: "T-13",
  event: LeadEvent.disposition_qualified,
  from: [LeadStatus.NOT_REACHABLE],
  to: LeadStatus.CONTACTED_QUALIFIED,
  extraGuards: ["callRecordAttached"],
  outbox: [
    { eventType: LeadEventType.LeadContacted, payload: {} },
    { eventType: LeadEventType.LeadQualified, payload: {} },
  ],
});

export const t14NotReachableWrongNumber = dispositionTransition({
  id: "T-14",
  event: LeadEvent.disposition_wrong_number,
  from: [LeadStatus.NOT_REACHABLE],
  to: LeadStatus.WRONG_NUMBER,
  outbox: [{ eventType: LeadEventType.LeadContacted, payload: {} }],
});

export const t15BookCounselling: TransitionFn = (current, ctx) => {
  const lead = requireLead(current, LeadEvent.book_counselling);
  assertFrom(lead, [LeadStatus.CONTACTED_QUALIFIED], LeadEvent.book_counselling);
  const guards = evaluateGuards(
    ["permissionCheck", "ownershipCheck", "personTypeRecipient", "counsellorAvailable", "notInDnc"],
    lead,
    ctx,
  );
  const to = LeadStatus.COUNSELLING_BOOKED;
  return pack({
    id: "T-15",
    nextStatus: to,
    writes: [
      { kind: "lead_patch", patch: { lastActivityAt: ctx.now } },
      {
        kind: "counselling_booking",
        counsellorUserId: ctx.payload.counsellorUserId ?? ctx.actor.userId,
        scheduledAt: ctx.payload.scheduledAt ?? ctx.now,
        mode: ctx.payload.mode ?? "VIDEO_CALL",
        meetingUrl: ctx.payload.meetingUrl ?? null,
        meetingLocation: ctx.payload.meetingLocation ?? null,
        durationMinutes: ctx.payload.durationMinutes ?? 30,
      },
      { kind: "activity", activityType: LeadActivityType.COUNSELLING, summary: "Counselling booked" },
      history(lead.status, to, LeadEvent.book_counselling, ctx, guards),
      statusActivity(lead.status, to, LeadEvent.book_counselling, ctx.payload.reason),
    ],
    auditEntries: [audit("counselling.book", { to })],
    outboxEvents: [{ eventType: LeadEventType.CounsellingBooked, payload: {} }],
    notifications: [
      { templateKey: "counselling_reminder_24h", payload: {} },
      { templateKey: "counselling_reminder_2h", payload: {} },
    ],
  });
};

export const t16ConvertDonor: TransitionFn = (current, ctx) => {
  const lead = requireLead(current, LeadEvent.convert_donor);
  assertFrom(lead, [LeadStatus.CONTACTED_QUALIFIED], LeadEvent.convert_donor);
  const guards = evaluateGuards(
    [
      "permissionCheck",
      "ownershipCheck",
      "personTypeDonor",
      "hasRequiredFields",
      "notInDnc",
      "noDuplicateConversion",
    ],
    lead,
    ctx,
  );
  const to = LeadStatus.CONVERTED;
  return pack({
    id: "T-16",
    nextStatus: to,
    writes: [
      {
        kind: "lead_patch",
        patch: { outcome: LeadOutcome.WON, convertedAt: ctx.now, lastActivityAt: ctx.now },
      },
      { kind: "conversion_stub", target: "DONOR" },
      { kind: "activity", activityType: LeadActivityType.CONVERSION, summary: "Converted to donor" },
      history(lead.status, to, LeadEvent.convert_donor, ctx, guards),
      statusActivity(lead.status, to, LeadEvent.convert_donor, ctx.payload.reason),
    ],
    auditEntries: [audit("lead.convert.donor", { to })],
    outboxEvents: [{ eventType: LeadEventType.LeadConverted, payload: { target: "DONOR" } }],
  });
};

export const t17SessionAttended: TransitionFn = (current, ctx) => {
  const lead = requireLead(current, LeadEvent.session_attended);
  assertFrom(lead, [LeadStatus.COUNSELLING_BOOKED], LeadEvent.session_attended);
  const guards = evaluateGuards(
    ["permissionCheck", "bookingExists", "sessionRecordAttached"],
    lead,
    ctx,
  );
  const to = LeadStatus.COUNSELLING_ATTENDED;
  return pack({
    id: "T-17",
    nextStatus: to,
    writes: [
      { kind: "lead_patch", patch: { lastActivityAt: ctx.now } },
      { kind: "counselling_session", attendance: "ATTENDED", notes: ctx.payload.notes ?? null },
      { kind: "counselling_booking_update", bookingStatus: "CLOSED", legacyStatus: "ATTENDED" },
      { kind: "activity", activityType: LeadActivityType.COUNSELLING, summary: "Session attended" },
      history(lead.status, to, LeadEvent.session_attended, ctx, guards),
      statusActivity(lead.status, to, LeadEvent.session_attended, ctx.payload.reason),
    ],
    auditEntries: [audit("counselling.session.record", { to })],
    outboxEvents: [{ eventType: LeadEventType.CounsellingAttended, payload: {} }],
  });
};

export const t18SessionNoShow: TransitionFn = (current, ctx) => {
  const lead = requireLead(current, LeadEvent.session_no_show);
  assertFrom(lead, [LeadStatus.COUNSELLING_BOOKED], LeadEvent.session_no_show);
  const guards = evaluateGuards(["permissionCheck", "bookingExists"], lead, ctx);
  const to = LeadStatus.COUNSELLING_NO_SHOW;
  return pack({
    id: "T-18",
    nextStatus: to,
    writes: [
      { kind: "lead_patch", patch: { lastActivityAt: ctx.now } },
      { kind: "counselling_session", attendance: "NO_SHOW", notes: ctx.payload.notes ?? null },
      { kind: "counselling_booking_update", bookingStatus: "CLOSED", legacyStatus: "NO_SHOW" },
      { kind: "activity", activityType: LeadActivityType.COUNSELLING, summary: "Session no-show" },
      history(lead.status, to, LeadEvent.session_no_show, ctx, guards),
      statusActivity(lead.status, to, LeadEvent.session_no_show, ctx.payload.reason),
    ],
    auditEntries: [audit("counselling.session.no_show", { to })],
    outboxEvents: [{ eventType: LeadEventType.CounsellingNoShow, payload: {} }],
  });
};

export const t19SessionCancelled: TransitionFn = (current, ctx) => {
  const lead = requireLead(current, LeadEvent.session_cancelled);
  assertFrom(lead, [LeadStatus.COUNSELLING_BOOKED], LeadEvent.session_cancelled);
  const guards = evaluateGuards(["permissionCheck", "bookingInFuture"], lead, ctx);
  const full = ctx.payload.cancelMode === "full";
  const to = full ? LeadStatus.CONTACTED_QUALIFIED : LeadStatus.COUNSELLING_BOOKED;
  const extra: DomainWrite[] = full
    ? [{ kind: "counselling_booking_update", bookingStatus: "CANCELLED", legacyStatus: "CANCELLED", cancelledReason: ctx.payload.reason ?? null }]
    : [
        { kind: "counselling_booking_update", bookingStatus: "RESCHEDULED", legacyStatus: "RESCHEDULED", cancelledReason: ctx.payload.reason ?? null },
        {
          kind: "counselling_booking",
          counsellorUserId: ctx.payload.counsellorUserId ?? ctx.actor.userId,
          scheduledAt: ctx.payload.scheduledAt ?? ctx.now,
          mode: ctx.payload.mode ?? "VIDEO_CALL",
        },
      ];
  return pack({
    id: "T-19",
    nextStatus: to,
    writes: [
      { kind: "lead_patch", patch: { lastActivityAt: ctx.now } },
      ...extra,
      { kind: "activity", activityType: LeadActivityType.COUNSELLING, summary: full ? "Booking cancelled" : "Booking rescheduled" },
      history(lead.status, to, LeadEvent.session_cancelled, ctx, guards),
      statusActivity(lead.status, to, LeadEvent.session_cancelled, ctx.payload.reason),
    ],
    auditEntries: [audit("counselling.session.cancel", { to, cancelMode: ctx.payload.cancelMode ?? "reschedule" })],
    outboxEvents: [],
  });
};

export const t20RebookCounselling: TransitionFn = (current, ctx) => {
  const lead = requireLead(current, LeadEvent.book_counselling);
  assertFrom(lead, [LeadStatus.COUNSELLING_NO_SHOW], LeadEvent.book_counselling);
  const guards = evaluateGuards(
    ["permissionCheck", "ownershipCheck", "attemptsRemaining", "counsellorAvailable"],
    lead,
    ctx,
  );
  const to = LeadStatus.COUNSELLING_BOOKED;
  return pack({
    id: "T-20",
    nextStatus: to,
    writes: [
      { kind: "lead_patch", patch: { lastActivityAt: ctx.now } },
      {
        kind: "counselling_booking",
        counsellorUserId: ctx.payload.counsellorUserId ?? ctx.actor.userId,
        scheduledAt: ctx.payload.scheduledAt ?? ctx.now,
        mode: ctx.payload.mode ?? "VIDEO_CALL",
      },
      { kind: "activity", activityType: LeadActivityType.COUNSELLING, summary: "Counselling rebooked" },
      history(lead.status, to, LeadEvent.book_counselling, ctx, guards),
      statusActivity(lead.status, to, LeadEvent.book_counselling, ctx.payload.reason),
    ],
    auditEntries: [audit("counselling.book", { to, rebook: true })],
    outboxEvents: [{ eventType: LeadEventType.CounsellingBooked, payload: { rebook: true } }],
  });
};

function markLost(args: {
  id: string;
  from: readonly LeadStatus[];
  extraGuards?: GuardName[];
  reason: string;
}): TransitionFn {
  return (current, ctx) => {
    const lead = requireLead(current, LeadEvent.mark_lost);
    assertFrom(lead, args.from, LeadEvent.mark_lost);
    const guards = evaluateGuards(["permissionCheck", ...(args.extraGuards ?? [])], lead, ctx);
    const to = LeadStatus.LOST;
    return pack({
      id: args.id,
      nextStatus: to,
      writes: [
        {
          kind: "lead_patch",
          patch: { outcome: LeadOutcome.LOST, lastActivityAt: ctx.now, lostReason: args.reason },
        },
        history(lead.status, to, LeadEvent.mark_lost, ctx, guards),
        statusActivity(lead.status, to, LeadEvent.mark_lost, args.reason),
      ],
      auditEntries: [audit("lead.mark_lost", { to, reason: args.reason })],
      outboxEvents: [{ eventType: LeadEventType.LeadLost, payload: { reason: args.reason } }],
    });
  };
}

export const t21NoShowMarkLost = markLost({
  id: "T-21",
  from: [LeadStatus.COUNSELLING_NO_SHOW],
  extraGuards: ["attemptsExhausted"],
  reason: "exhausted_no_shows",
});

export const t22ConvertRecipient: TransitionFn = (current, ctx) => {
  const lead = requireLead(current, LeadEvent.convert_recipient);
  assertFrom(lead, [LeadStatus.COUNSELLING_ATTENDED], LeadEvent.convert_recipient);
  const guards = evaluateGuards(
    [
      "permissionCheck",
      "recommendationRegister",
      "noDuplicateConversion",
      "notInDnc",
    ],
    lead,
    ctx,
  );
  const to = LeadStatus.CONVERTED;
  return pack({
    id: "T-22",
    nextStatus: to,
    writes: [
      {
        kind: "lead_patch",
        patch: { outcome: LeadOutcome.WON, convertedAt: ctx.now, lastActivityAt: ctx.now },
      },
      { kind: "conversion_stub", target: "RECIPIENT" },
      { kind: "activity", activityType: LeadActivityType.CONVERSION, summary: "Converted to recipient" },
      history(lead.status, to, LeadEvent.convert_recipient, ctx, guards),
      statusActivity(lead.status, to, LeadEvent.convert_recipient, ctx.payload.reason),
    ],
    auditEntries: [audit("lead.convert.recipient", { to })],
    outboxEvents: [{ eventType: LeadEventType.LeadConverted, payload: { target: "RECIPIENT" } }],
  });
};

export const t23RecordOutcomeDefer: TransitionFn = (current, ctx) => {
  const lead = requireLead(current, LeadEvent.session_attended);
  assertFrom(lead, [LeadStatus.COUNSELLING_ATTENDED], LeadEvent.session_attended);
  const guards = evaluateGuards(["permissionCheck"], lead, ctx);
  const to = LeadStatus.COUNSELLING_ATTENDED;
  const extra: DomainWrite[] = [];
  if (ctx.payload.dueAt) {
    extra.push({
      kind: "follow_up",
      followUpType: "RECONTACT",
      dueAt: ctx.payload.dueAt,
      reason: ctx.payload.reason ?? null,
    });
  }
  return pack({
    id: "T-23",
    nextStatus: to,
    writes: [
      { kind: "lead_patch", patch: { lastActivityAt: ctx.now } },
      {
        kind: "counselling_outcome",
        recommendation: ctx.payload.recommendation ?? "DEFER",
        rationale: ctx.payload.notes ?? ctx.payload.reason ?? null,
      },
      ...extra,
      { kind: "activity", activityType: LeadActivityType.COUNSELLING, summary: "Outcome recorded" },
      history(lead.status, to, LeadEvent.session_attended, ctx, guards),
      statusActivity(lead.status, to, LeadEvent.session_attended, ctx.payload.reason),
    ],
    auditEntries: [audit("counselling.outcome.record", { to })],
    outboxEvents: [],
  });
};

export const t24NotInterestedMarkLost = markLost({
  id: "T-24",
  from: [LeadStatus.CONTACTED_NOT_INTERESTED],
  reason: "not_interested_elapsed",
});

export const t25WrongNumberMarkLost = markLost({
  id: "T-25",
  from: [LeadStatus.WRONG_NUMBER],
  reason: "wrong_number_elapsed",
});

export const t26DncMarkLost = markLost({
  id: "T-26",
  from: [LeadStatus.DO_NOT_CALL],
  reason: "dnc_immediate",
});

export const t27Archive: TransitionFn = (current, ctx) => {
  const lead = requireLead(current, LeadEvent.archive);
  assertNonTerminal(lead, LeadEvent.archive);
  const guards = evaluateGuards(["permissionCheck", "reasonSupplied", "notArchivedRequired"], lead, ctx);
  const to = lead.status;
  return pack({
    id: "T-27",
    nextStatus: to,
    writes: [
      {
        kind: "lead_patch",
        patch: {
          isArchived: true,
          archivedAt: ctx.now,
          archivedByUserId: ctx.actor.userId,
          archiveReason: ctx.payload.reason ?? null,
          lastActivityAt: ctx.now,
        },
      },
      { kind: "activity", activityType: LeadActivityType.SYSTEM, summary: "Lead archived" },
      history(lead.status, to, LeadEvent.archive, ctx, guards),
      statusActivity(lead.status, to, LeadEvent.archive, ctx.payload.reason),
    ],
    auditEntries: [audit("lead.archive", { to, isArchived: true })],
    outboxEvents: [{ eventType: LeadEventType.LeadArchived, payload: { reason: ctx.payload.reason ?? null } }],
  });
};

export const t28Unarchive: TransitionFn = (current, ctx) => {
  const lead = requireLead(current, LeadEvent.unarchive);
  if (NON_REACTIVATABLE_TERMINAL.includes(lead.status)) {
    assertI02Terminal(lead.status, LeadEvent.unarchive);
  }
  const guards = evaluateGuards(["permissionCheck", "reasonSupplied", "isArchivedRequired"], lead, ctx);
  const to = lead.status;
  return pack({
    id: "T-28",
    nextStatus: to,
    writes: [
      {
        kind: "lead_patch",
        patch: {
          isArchived: false,
          archivedAt: null,
          archivedByUserId: null,
          archiveReason: null,
          lastActivityAt: ctx.now,
        },
      },
      { kind: "activity", activityType: LeadActivityType.SYSTEM, summary: "Lead unarchived" },
      history(lead.status, to, LeadEvent.unarchive, ctx, guards),
      statusActivity(lead.status, to, LeadEvent.unarchive, ctx.payload.reason),
    ],
    auditEntries: [audit("lead.unarchive", { to, isArchived: false })],
    outboxEvents: [],
  });
};

export const t29Reactivate: TransitionFn = (current, ctx) => {
  const lead = requireLead(current, LeadEvent.reactivate);
  assertFrom(lead, [LeadStatus.LOST], LeadEvent.reactivate);
  const guards = evaluateGuards(
    ["permissionCheck", "withinReactivationWindow", "notMerged", "reasonSupplied"],
    lead,
    ctx,
  );
  const to = LeadStatus.ASSIGNED;
  const assignee = ctx.payload.assigneeUserId ?? ctx.actor.userId;
  return pack({
    id: "T-29",
    nextStatus: to,
    writes: [
      {
        kind: "lead_patch",
        patch: { outcome: null, assignedTelecallerId: assignee, lastActivityAt: ctx.now },
      },
      {
        kind: "assignment",
        assigneeUserId: assignee,
        assignmentType: "MANUAL",
        reason: ctx.payload.reason ?? "reactivation",
        closePrior: true,
        siteId: ctx.payload.siteId ?? ctx.actor.siteId,
      },
      {
        kind: "activity",
        activityType: LeadActivityType.SYSTEM,
        summary: "Lead reactivated",
        metadata: { reason: ctx.payload.reason ?? null },
      },
      history(lead.status, to, LeadEvent.reactivate, ctx, guards),
      statusActivity(lead.status, to, LeadEvent.reactivate, ctx.payload.reason),
    ],
    auditEntries: [audit("lead.reactivate", { to })],
    outboxEvents: [{ eventType: LeadEventType.LeadReactivated, payload: { assigneeUserId: assignee } }],
  });
};

export const t30Expire: TransitionFn = (current, ctx) => {
  const lead = requireLead(current, LeadEvent.expire_by_retention);
  if (!WORKING_NON_TERMINAL.includes(lead.status)) {
    throw new LeadStateTransitionNotAllowedError("STATE_TRANSITION_NOT_ALLOWED", {
      fromStatus: lead.status,
      event: LeadEvent.expire_by_retention,
    });
  }
  if (NON_REACTIVATABLE_TERMINAL.includes(lead.status)) {
    assertI02Terminal(lead.status, LeadEvent.expire_by_retention);
  }
  const guards = evaluateGuards(["permissionCheck", "retentionExpired"], lead, ctx);
  const to = LeadStatus.EXPIRED_AUTO_PURGED;
  return pack({
    id: "T-30",
    nextStatus: to,
    writes: [
      {
        kind: "lead_patch",
        patch: {
          outcome: LeadOutcome.EXPIRED,
          redactedAt: ctx.now,
          redactionReason: "retention_expiry",
          lastActivityAt: ctx.now,
        },
      },
      { kind: "redact_pii" },
      { kind: "activity", activityType: LeadActivityType.SYSTEM, summary: "Expired by retention" },
      history(lead.status, to, LeadEvent.expire_by_retention, ctx, guards),
      statusActivity(lead.status, to, LeadEvent.expire_by_retention, "retention_expiry"),
    ],
    auditEntries: [audit("lead.expire", { to })],
    outboxEvents: [],
  });
};

export const t31MergeLoser: TransitionFn = (current, ctx) => {
  const lead = requireLead(current, LeadEvent.merge_loser);
  assertNonTerminal(lead, LeadEvent.merge_loser);
  const guards = evaluateGuards(
    ["permissionCheck", "leadMergeExists", "notConvertedLoser"],
    lead,
    ctx,
  );
  const to = LeadStatus.LOST;
  const winner = ctx.payload.winnerLeadId ?? "";
  return pack({
    id: "T-31",
    nextStatus: to,
    writes: [
      {
        kind: "lead_patch",
        patch: {
          outcome: LeadOutcome.MERGED,
          isArchived: true,
          archivedAt: ctx.now,
          archivedByUserId: ctx.actor.userId,
          archiveReason: "merged",
          mergedIntoLeadId: winner,
          lastActivityAt: ctx.now,
        },
      },
      { kind: "merge_stub", winnerLeadId: winner },
      { kind: "activity", activityType: LeadActivityType.MERGE, summary: `Merged into ${winner}` },
      history(lead.status, to, LeadEvent.merge_loser, ctx, guards),
      statusActivity(lead.status, to, LeadEvent.merge_loser, ctx.payload.reason),
    ],
    auditEntries: [audit("lead.merge", { to, winnerLeadId: winner })],
    outboxEvents: [{ eventType: LeadEventType.LeadMerged, payload: { winnerLeadId: winner } }],
  });
};

function pickDisposition(lead: Lead, event: StateMachineEvent): TransitionFn | null {
  if (event === LeadEvent.disposition_qualified) {
    if (lead.status === LeadStatus.ASSIGNED) return t05DispositionQualified;
    if (lead.status === LeadStatus.CONTACTED_CALLBACK_REQUESTED) return t11CallbackQualified;
    if (lead.status === LeadStatus.NOT_REACHABLE) return t13NotReachableQualified;
  }
  if (event === LeadEvent.disposition_not_interested) {
    if (lead.status === LeadStatus.ASSIGNED) return t06DispositionNotInterested;
    if (lead.status === LeadStatus.CONTACTED_CALLBACK_REQUESTED) return t12CallbackNotInterested;
  }
  if (event === LeadEvent.disposition_wrong_number) {
    if (lead.status === LeadStatus.ASSIGNED) return t09DispositionWrongNumber;
    if (lead.status === LeadStatus.NOT_REACHABLE) return t14NotReachableWrongNumber;
  }
  if (event === LeadEvent.book_counselling) {
    if (lead.status === LeadStatus.CONTACTED_QUALIFIED) return t15BookCounselling;
    if (lead.status === LeadStatus.COUNSELLING_NO_SHOW) return t20RebookCounselling;
  }
  if (event === LeadEvent.session_attended) {
    if (lead.status === LeadStatus.COUNSELLING_BOOKED) return t17SessionAttended;
    if (lead.status === LeadStatus.COUNSELLING_ATTENDED) return t23RecordOutcomeDefer;
  }
  if (event === LeadEvent.mark_lost) {
    if (lead.status === LeadStatus.COUNSELLING_NO_SHOW) return t21NoShowMarkLost;
    if (lead.status === LeadStatus.CONTACTED_NOT_INTERESTED) return t24NotInterestedMarkLost;
    if (lead.status === LeadStatus.WRONG_NUMBER) return t25WrongNumberMarkLost;
    if (lead.status === LeadStatus.DO_NOT_CALL) return t26DncMarkLost;
  }
  return null;
}

const BY_EVENT: Partial<Record<StateMachineEvent, TransitionFn>> = {
  [LeadEvent.intake]: t01Intake,
  [LeadEvent.assign]: t02Assign,
  [LeadEvent.reassign]: t03Reassign,
  [LeadEvent.claim]: t04Claim,
  [LeadEvent.disposition_callback]: t07DispositionCallback,
  [LeadEvent.disposition_not_reachable]: t08DispositionNotReachable,
  [LeadEvent.disposition_do_not_call]: t10DispositionDoNotCall,
  [LeadEvent.session_no_show]: t18SessionNoShow,
  [LeadEvent.session_cancelled]: t19SessionCancelled,
  [LeadEvent.convert_donor]: t16ConvertDonor,
  [LeadEvent.convert_recipient]: t22ConvertRecipient,
  [LeadEvent.archive]: t27Archive,
  [LeadEvent.unarchive]: t28Unarchive,
  [LeadEvent.reactivate]: t29Reactivate,
  [LeadEvent.expire_by_retention]: t30Expire,
  [LeadEvent.merge_loser]: t31MergeLoser,
};

export function transition(
  currentLead: Lead | null,
  event: StateMachineEvent,
  ctx: TransitionContext,
): TransitionResult {
  if (currentLead && NON_REACTIVATABLE_TERMINAL.includes(currentLead.status)) {
    throw new LeadStateTransitionNotAllowedError("STATE_TRANSITION_NOT_ALLOWED", {
      fromStatus: currentLead.status,
      event,
    });
  }
  if (currentLead?.status === LeadStatus.LOST && event !== LeadEvent.reactivate) {
    throw new LeadStateTransitionNotAllowedError("STATE_TRANSITION_NOT_ALLOWED", {
      fromStatus: currentLead.status,
      event,
    });
  }

  const routed = currentLead ? pickDisposition(currentLead, event) : null;
  const fn = routed ?? BY_EVENT[event];
  if (!fn) {
    throw new LeadStateTransitionNotAllowedError("STATE_TRANSITION_NOT_ALLOWED", {
      fromStatus: currentLead?.status ?? null,
      event,
    });
  }
  return fn(currentLead, ctx);
}

export const TRANSITION_FNS = {
  "T-01": t01Intake,
  "T-02": t02Assign,
  "T-03": t03Reassign,
  "T-04": t04Claim,
  "T-05": t05DispositionQualified,
  "T-06": t06DispositionNotInterested,
  "T-07": t07DispositionCallback,
  "T-08": t08DispositionNotReachable,
  "T-09": t09DispositionWrongNumber,
  "T-10": t10DispositionDoNotCall,
  "T-11": t11CallbackQualified,
  "T-12": t12CallbackNotInterested,
  "T-13": t13NotReachableQualified,
  "T-14": t14NotReachableWrongNumber,
  "T-15": t15BookCounselling,
  "T-16": t16ConvertDonor,
  "T-17": t17SessionAttended,
  "T-18": t18SessionNoShow,
  "T-19": t19SessionCancelled,
  "T-20": t20RebookCounselling,
  "T-21": t21NoShowMarkLost,
  "T-22": t22ConvertRecipient,
  "T-23": t23RecordOutcomeDefer,
  "T-24": t24NotInterestedMarkLost,
  "T-25": t25WrongNumberMarkLost,
  "T-26": t26DncMarkLost,
  "T-27": t27Archive,
  "T-28": t28Unarchive,
  "T-29": t29Reactivate,
  "T-30": t30Expire,
  "T-31": t31MergeLoser,
} as const;
