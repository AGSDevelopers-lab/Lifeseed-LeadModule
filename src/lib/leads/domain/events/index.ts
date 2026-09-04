import type { LeadEventType } from "../enums";

export abstract class LeadDomainEvent {
  abstract readonly type: LeadEventType;
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly payload: Readonly<Record<string, unknown>>,
    readonly eventVersion = 1,
  ) {}
}

export class LeadCreated extends LeadDomainEvent {
  readonly type = "LeadCreated" as const;
}
export class LeadAssigned extends LeadDomainEvent {
  readonly type = "LeadAssigned" as const;
}
export class LeadContacted extends LeadDomainEvent {
  readonly type = "LeadContacted" as const;
}
export class LeadQualified extends LeadDomainEvent {
  readonly type = "LeadQualified" as const;
}
export class LeadFollowUpCreated extends LeadDomainEvent {
  readonly type = "LeadFollowUpCreated" as const;
}
export class LeadFollowUpCompleted extends LeadDomainEvent {
  readonly type = "LeadFollowUpCompleted" as const;
}
export class CounsellingBooked extends LeadDomainEvent {
  readonly type = "CounsellingBooked" as const;
}
export class CounsellingAttended extends LeadDomainEvent {
  readonly type = "CounsellingAttended" as const;
}
export class CounsellingNoShow extends LeadDomainEvent {
  readonly type = "CounsellingNoShow" as const;
}
export class LeadLost extends LeadDomainEvent {
  readonly type = "LeadLost" as const;
}
export class LeadConverted extends LeadDomainEvent {
  readonly type = "LeadConverted" as const;
}
export class LeadMerged extends LeadDomainEvent {
  readonly type = "LeadMerged" as const;
}
export class LeadDncAdded extends LeadDomainEvent {
  readonly type = "LeadDncAdded" as const;
}
export class LeadScoreChanged extends LeadDomainEvent {
  readonly type = "LeadScoreChanged" as const;
}
export class LeadArchived extends LeadDomainEvent {
  readonly type = "LeadArchived" as const;
}
export class LeadReactivated extends LeadDomainEvent {
  readonly type = "LeadReactivated" as const;
}

export const LEAD_EVENT_TYPES = [
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
] as const satisfies readonly LeadEventType[];
