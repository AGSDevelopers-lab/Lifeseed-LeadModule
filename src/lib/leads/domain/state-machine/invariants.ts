import { LeadInvariantViolationError } from "../errors";
import { LeadOutcome, LeadStatus, type LeadEventType } from "../enums";
import type { TransitionResult } from "./types";
import { NON_REACTIVATABLE_TERMINAL } from "./types";

export function assertInvariant(
  id: string,
  condition: boolean,
  message: string,
  context: Record<string, unknown> = {},
): void {
  if (!condition) {
    throw new LeadInvariantViolationError(message, { invariant: id, ...context });
  }
}

/** I-02: terminal states cannot transition (except LOST → reactivate). */
export function assertI02Terminal(fromStatus: LeadStatus | null, event: string): void {
  if (!fromStatus) return;
  if (NON_REACTIVATABLE_TERMINAL.includes(fromStatus)) {
    assertInvariant(
      "I-02",
      false,
      "Terminal states cannot transition",
      { fromStatus, event },
    );
  }
}

/** I-08: outcome set only for terminal states or MERGED loser. */
export function assertI08Outcome(nextStatus: LeadStatus, outcome: LeadOutcome | null | undefined): void {
  if (outcome == null) return;
  const ok =
    (nextStatus === LeadStatus.CONVERTED && outcome === LeadOutcome.WON) ||
    (nextStatus === LeadStatus.LOST &&
      (outcome === LeadOutcome.LOST || outcome === LeadOutcome.MERGED)) ||
    (nextStatus === LeadStatus.EXPIRED_AUTO_PURGED && outcome === LeadOutcome.EXPIRED);
  assertInvariant("I-08", ok, "Lead.outcome is only valid for terminal/merged states", {
    nextStatus,
    outcome,
  });
}

/** I-09: isArchived=true requires archivedAt and archivedByUserId. */
export function assertI09Archive(patch: {
  isArchived?: boolean;
  archivedAt?: Date | null;
  archivedByUserId?: string | null;
}): void {
  if (patch.isArchived !== true) return;
  assertInvariant(
    "I-09",
    Boolean(patch.archivedAt && patch.archivedByUserId),
    "Archived leads require archivedAt and archivedByUserId",
    patch,
  );
}

/** I-11: every history row has an outbox event or is marked internal-only. */
export function assertI11HistoryOutbox(result: TransitionResult): void {
  const histories = result.writes.filter((w) => w.kind === "status_history");
  const hasOutbox = result.outboxEvents.some((o) => !o.internalOnly);
  const internalNoted =
    result.outboxEvents.some((o) => o.internalOnly) ||
    result.transitionId === "T-19" ||
    result.transitionId === "T-23" ||
    result.transitionId === "T-28" ||
    result.transitionId === "T-30";
  for (const h of histories) {
    assertInvariant(
      "I-11",
      hasOutbox || internalNoted,
      "Status history must correspond to an outbox event or be internal-only",
      { event: h.event, transitionId: result.transitionId },
    );
  }
}

/** I-15: exactly one status history + one STATUS_CHANGE activity per transition. */
export function assertI15DoubleWrite(result: TransitionResult): void {
  const history = result.writes.filter((w) => w.kind === "status_history");
  const statusActivity = result.writes.filter(
    (w) => w.kind === "activity" && w.activityType === "STATUS_CHANGE",
  );
  assertInvariant(
    "I-15",
    history.length === 1 && statusActivity.length === 1,
    "Each transition must write exactly one LeadStatusHistory and one STATUS_CHANGE activity",
    { history: history.length, statusActivity: statusActivity.length, transitionId: result.transitionId },
  );
}

export function assertTransitionInvariants(result: TransitionResult): void {
  const patchWrites = result.writes.filter((w) => w.kind === "lead_patch");
  const mergedPatch = patchWrites.reduce(
    (acc, w) => ({ ...acc, ...w.patch }),
    {} as { outcome?: LeadOutcome | null; isArchived?: boolean; archivedAt?: Date | null; archivedByUserId?: string | null },
  );
  assertI08Outcome(result.nextStatus, mergedPatch.outcome ?? null);
  assertI09Archive(mergedPatch);
  assertI15DoubleWrite(result);
  assertI11HistoryOutbox(result);
}

export function assertNoActiveAssignmentCollision(openAssignmentCount: number): void {
  assertInvariant("I-05", openAssignmentCount <= 1, "Only one active LeadAssignment per lead", {
    openAssignmentCount,
  });
}

export function assertSingleConversion(existingCount: number): void {
  assertInvariant("I-03", existingCount <= 1, "LeadConversion.leadId must be unique", {
    existingCount,
  });
}

export const OUTBOX_EVENT_TYPES: readonly LeadEventType[] = [
  "LeadCreated",
  "LeadAssigned",
  "LeadContacted",
  "LeadQualified",
  "LeadFollowUpCreated",
  "LeadFollowUpCompleted",
  "CounsellingBooked",
  "CounsellingAttended",
  "CounsellingNoShow",
  "LeadLost",
  "LeadConverted",
  "LeadMerged",
  "LeadDncAdded",
  "LeadScoreChanged",
  "LeadArchived",
  "LeadReactivated",
];
