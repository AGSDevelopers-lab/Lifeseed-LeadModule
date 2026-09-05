/** Domain enums — pure TS, independent of Prisma. */

export const LeadPersonType = { DONOR: "DONOR", RECIPIENT: "RECIPIENT" } as const;
export type LeadPersonType = (typeof LeadPersonType)[keyof typeof LeadPersonType];

export const LeadDonorSubType = { SEMEN: "SEMEN", OOCYTE: "OOCYTE" } as const;
export type LeadDonorSubType = (typeof LeadDonorSubType)[keyof typeof LeadDonorSubType];

export const LeadSource = {
  WEB_FORM: "WEB_FORM",
  WHATSAPP_BOT: "WHATSAPP_BOT",
  PHONE_INBOUND: "PHONE_INBOUND",
  WALK_IN: "WALK_IN",
  REFERRAL: "REFERRAL",
  SOCIAL_FACEBOOK: "SOCIAL_FACEBOOK",
  SOCIAL_INSTAGRAM: "SOCIAL_INSTAGRAM",
  SOCIAL_GOOGLE_ADS: "SOCIAL_GOOGLE_ADS",
  CLINIC_REFERRAL: "CLINIC_REFERRAL",
  PARTNER_HOSPITAL: "PARTNER_HOSPITAL",
  OTHER: "OTHER",
  HOSPITAL_REFERRAL: "HOSPITAL_REFERRAL",
  PARTNER: "PARTNER",
  CAMPAIGN: "CAMPAIGN",
  API: "API",
  MANUAL: "MANUAL",
} as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];

export const LeadLanguage = {
  ENGLISH: "ENGLISH",
  HINDI: "HINDI",
  BENGALI: "BENGALI",
  TELUGU: "TELUGU",
  OTHER: "OTHER",
} as const;
export type LeadLanguage = (typeof LeadLanguage)[keyof typeof LeadLanguage];

export const LeadStatus = {
  NEW: "NEW",
  ASSIGNED: "ASSIGNED",
  CONTACTED_QUALIFIED: "CONTACTED_QUALIFIED",
  CONTACTED_NOT_INTERESTED: "CONTACTED_NOT_INTERESTED",
  CONTACTED_CALLBACK_REQUESTED: "CONTACTED_CALLBACK_REQUESTED",
  NOT_REACHABLE: "NOT_REACHABLE",
  WRONG_NUMBER: "WRONG_NUMBER",
  DO_NOT_CALL: "DO_NOT_CALL",
  COUNSELLING_BOOKED: "COUNSELLING_BOOKED",
  COUNSELLING_ATTENDED: "COUNSELLING_ATTENDED",
  COUNSELLING_NO_SHOW: "COUNSELLING_NO_SHOW",
  CONVERTED: "CONVERTED",
  LOST: "LOST",
  EXPIRED_AUTO_PURGED: "EXPIRED_AUTO_PURGED",
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

export const LeadOutcome = {
  WON: "WON",
  LOST: "LOST",
  EXPIRED: "EXPIRED",
  MERGED: "MERGED",
} as const;
export type LeadOutcome = (typeof LeadOutcome)[keyof typeof LeadOutcome];

export const LeadTier = {
  HOT: "HOT",
  WARM: "WARM",
  COLD: "COLD",
  ARCHIVED: "ARCHIVED",
} as const;
export type LeadTier = (typeof LeadTier)[keyof typeof LeadTier];

export const LeadEvent = {
  intake: "intake",
  assign: "assign",
  reassign: "reassign",
  claim: "claim",
  disposition_qualified: "disposition_qualified",
  disposition_not_interested: "disposition_not_interested",
  disposition_callback: "disposition_callback",
  disposition_not_reachable: "disposition_not_reachable",
  disposition_wrong_number: "disposition_wrong_number",
  disposition_do_not_call: "disposition_do_not_call",
  book_counselling: "book_counselling",
  session_attended: "session_attended",
  session_no_show: "session_no_show",
  session_cancelled: "session_cancelled",
  convert_donor: "convert_donor",
  convert_recipient: "convert_recipient",
  archive: "archive",
  unarchive: "unarchive",
  reactivate: "reactivate",
  expire_by_retention: "expire_by_retention",
  merge_loser: "merge_loser",
  /** T-21 / T-24 / T-25 / T-26 — present in 04 workflow, omitted from 03 enum list. */
  mark_lost: "mark_lost",
} as const;
export type LeadEvent = (typeof LeadEvent)[keyof typeof LeadEvent];

export const LeadActivityType = {
  CALL: "CALL",
  WHATSAPP: "WHATSAPP",
  SMS: "SMS",
  EMAIL: "EMAIL",
  NOTE: "NOTE",
  FOLLOW_UP: "FOLLOW_UP",
  COUNSELLING: "COUNSELLING",
  APPOINTMENT: "APPOINTMENT",
  STATUS_CHANGE: "STATUS_CHANGE",
  ASSIGNMENT: "ASSIGNMENT",
  ESCALATION: "ESCALATION",
  CONVERSION: "CONVERSION",
  MERGE: "MERGE",
  DNC: "DNC",
  SYSTEM: "SYSTEM",
} as const;
export type LeadActivityType = (typeof LeadActivityType)[keyof typeof LeadActivityType];

export const LeadChannel = {
  INBOUND: "INBOUND",
  OUTBOUND: "OUTBOUND",
  SYSTEM: "SYSTEM",
} as const;
export type LeadChannel = (typeof LeadChannel)[keyof typeof LeadChannel];

export const AssignmentType = {
  AUTO_ROUND_ROBIN: "AUTO_ROUND_ROBIN",
  MANUAL: "MANUAL",
  REASSIGN: "REASSIGN",
  CLAIM: "CLAIM",
  ESCALATION: "ESCALATION",
} as const;
export type AssignmentType = (typeof AssignmentType)[keyof typeof AssignmentType];

export const FollowUpType = {
  CALLBACK: "CALLBACK",
  RECONTACT: "RECONTACT",
  COUNSELLING_REMINDER: "COUNSELLING_REMINDER",
  DOC_REQUEST: "DOC_REQUEST",
  CUSTOM: "CUSTOM",
} as const;
export type FollowUpType = (typeof FollowUpType)[keyof typeof FollowUpType];

export const FollowUpPriority = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;
export type FollowUpPriority = (typeof FollowUpPriority)[keyof typeof FollowUpPriority];

export const FollowUpStatus = {
  OPEN: "OPEN",
  DUE: "DUE",
  OVERDUE: "OVERDUE",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  RESCHEDULED: "RESCHEDULED",
} as const;
export type FollowUpStatus = (typeof FollowUpStatus)[keyof typeof FollowUpStatus];

export const BookingStatus = {
  SCHEDULED: "SCHEDULED",
  RESCHEDULED: "RESCHEDULED",
  CANCELLED: "CANCELLED",
  CLOSED: "CLOSED",
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const SessionAttendance = {
  ATTENDED: "ATTENDED",
  NO_SHOW: "NO_SHOW",
  CANCELLED_BY_CLINIC: "CANCELLED_BY_CLINIC",
  CANCELLED_BY_LEAD: "CANCELLED_BY_LEAD",
} as const;
export type SessionAttendance = (typeof SessionAttendance)[keyof typeof SessionAttendance];

export const CounsellingRecommendation = {
  RECOMMEND_REGISTER: "RECOMMEND_REGISTER",
  DEFER: "DEFER",
  DECLINE: "DECLINE",
  REFER_OUT: "REFER_OUT",
} as const;
export type CounsellingRecommendation =
  (typeof CounsellingRecommendation)[keyof typeof CounsellingRecommendation];

export const CampaignStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  ENDED: "ENDED",
} as const;
export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export const TouchType = { FIRST: "FIRST", SUBSEQUENT: "SUBSEQUENT" } as const;
export type TouchType = (typeof TouchType)[keyof typeof TouchType];

export const MatchLevel = {
  EXACT: "EXACT",
  PROBABLE: "PROBABLE",
  POSSIBLE: "POSSIBLE",
} as const;
export type MatchLevel = (typeof MatchLevel)[keyof typeof MatchLevel];

export const DupReviewStatus = {
  OPEN: "OPEN",
  UNDER_REVIEW: "UNDER_REVIEW",
  MERGED: "MERGED",
  KEPT_SEPARATE: "KEPT_SEPARATE",
  DISMISSED: "DISMISSED",
} as const;
export type DupReviewStatus = (typeof DupReviewStatus)[keyof typeof DupReviewStatus];

export const MergeCopyStrategy = {
  COPY_ALL: "COPY_ALL",
  COPY_MEANINGFUL: "COPY_MEANINGFUL",
  REFERENCE_ONLY: "REFERENCE_ONLY",
} as const;
export type MergeCopyStrategy = (typeof MergeCopyStrategy)[keyof typeof MergeCopyStrategy];

export const DncChannel = {
  PHONE: "PHONE",
  EMAIL: "EMAIL",
  WHATSAPP: "WHATSAPP",
  SMS: "SMS",
  ALL: "ALL",
} as const;
export type DncChannel = (typeof DncChannel)[keyof typeof DncChannel];

export const DncSource = {
  SELF_REQUEST: "SELF_REQUEST",
  OPS_ADD: "OPS_ADD",
  COMPLIANCE_ADD: "COMPLIANCE_ADD",
  LEAD_REQUEST: "LEAD_REQUEST",
  REGULATOR: "REGULATOR",
  SYSTEM: "SYSTEM",
  UNSUBSCRIBE_LINK: "UNSUBSCRIBE_LINK",
  MANUAL: "MANUAL",
} as const;
export type DncSource = (typeof DncSource)[keyof typeof DncSource];

export const ConversionTarget = { DONOR: "DONOR", RECIPIENT: "RECIPIENT" } as const;
export type ConversionTarget = (typeof ConversionTarget)[keyof typeof ConversionTarget];

export const LeadEventType = {
  LeadCreated: "LeadCreated",
  LeadAssigned: "LeadAssigned",
  LeadContacted: "LeadContacted",
  LeadQualified: "LeadQualified",
  LeadFollowUpCreated: "LeadFollowUpCreated",
  LeadFollowUpCompleted: "LeadFollowUpCompleted",
  CounsellingBooked: "CounsellingBooked",
  CounsellingAttended: "CounsellingAttended",
  CounsellingNoShow: "CounsellingNoShow",
  LeadLost: "LeadLost",
  LeadConverted: "LeadConverted",
  LeadMerged: "LeadMerged",
  LeadDncAdded: "LeadDncAdded",
  LeadScoreChanged: "LeadScoreChanged",
  LeadArchived: "LeadArchived",
  LeadReactivated: "LeadReactivated",
} as const;
export type LeadEventType = (typeof LeadEventType)[keyof typeof LeadEventType];

export const DispatchStatus = {
  PENDING: "PENDING",
  IN_FLIGHT: "IN_FLIGHT",
  PUBLISHED: "PUBLISHED",
  FAILED: "FAILED",
  DEAD: "DEAD",
} as const;
export type DispatchStatus = (typeof DispatchStatus)[keyof typeof DispatchStatus];

export const DlqResolution = {
  REPUBLISH: "REPUBLISH",
  DISCARD: "DISCARD",
  MANUAL_FIX: "MANUAL_FIX",
} as const;
export type DlqResolution = (typeof DlqResolution)[keyof typeof DlqResolution];

export const NotificationChannel = {
  EMAIL: "EMAIL",
  SMS: "SMS",
  WHATSAPP: "WHATSAPP",
  IN_APP: "IN_APP",
} as const;
export type NotificationChannel =
  (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationProvider = {
  RESEND: "RESEND",
  SMS_MAGIC: "SMS_MAGIC",
  META_WHATSAPP: "META_WHATSAPP",
  IN_APP: "IN_APP",
} as const;
export type NotificationProvider =
  (typeof NotificationProvider)[keyof typeof NotificationProvider];

export const DeliveryStatus = {
  QUEUED: "QUEUED",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  FAILED: "FAILED",
  BOUNCED: "BOUNCED",
  READ: "READ",
  REPLIED: "REPLIED",
  BLOCKED_DNC: "BLOCKED_DNC",
} as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const CrmOperation = {
  UPSERT_LEAD: "UPSERT_LEAD",
  UPDATE_STATUS: "UPDATE_STATUS",
  LOG_ACTIVITY: "LOG_ACTIVITY",
  CLOSE_LEAD: "CLOSE_LEAD",
  CONVERT: "CONVERT",
} as const;
export type CrmOperation = (typeof CrmOperation)[keyof typeof CrmOperation];

export const ScoreTrigger = {
  intake: "intake",
  manual_rescore: "manual_rescore",
  config_version_change: "config_version_change",
  activity_signal: "activity_signal",
} as const;
export type ScoreTrigger = (typeof ScoreTrigger)[keyof typeof ScoreTrigger];

export const CONVERTIBLE_STATUSES: readonly LeadStatus[] = [
  LeadStatus.CONTACTED_QUALIFIED,
  LeadStatus.COUNSELLING_ATTENDED,
];
