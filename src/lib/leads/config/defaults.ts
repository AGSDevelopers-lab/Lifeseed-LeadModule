import { LeadSource, LeadStatus } from "@prisma/client";

import { CONFIG_KEYS, type ConfigKey } from "./keys";
import type {
  AssignmentRules,
  RetentionPolicy,
  ScoreWeights,
  SlaMatrix,
} from "./schemas";

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  sourcePoints: {
    [LeadSource.REFERRAL]: 20,
    [LeadSource.CLINIC_REFERRAL]: 18,
    [LeadSource.WALK_IN]: 15,
    [LeadSource.WEB_FORM]: 10,
    [LeadSource.WHATSAPP_BOT]: 10,
    [LeadSource.PHONE_INBOUND]: 8,
    [LeadSource.SOCIAL_FACEBOOK]: 5,
    [LeadSource.SOCIAL_INSTAGRAM]: 5,
    [LeadSource.SOCIAL_GOOGLE_ADS]: 5,
    [LeadSource.PARTNER_HOSPITAL]: 15,
    [LeadSource.OTHER]: 2,
    [LeadSource.HOSPITAL_REFERRAL]: 2,
    [LeadSource.PARTNER]: 2,
    [LeadSource.CAMPAIGN]: 2,
    [LeadSource.API]: 2,
    [LeadSource.MANUAL]: 2,
  },
  serviceAreas: [
    "wb",
    "westbengal",
    "tg",
    "telangana",
    "del",
    "delhi",
    "mum",
    "mumbai",
    "blr",
    "bangalore",
    "bengaluru",
    "hyd",
    "hyderabad",
    "kol",
    "kolkata",
  ],
  supportedLanguages: ["english", "hindi", "bengali", "telugu"],
  completenessMax: 20,
  locationInServiceArea: 10,
  locationOutOfArea: 3,
  languageSupported: 5,
  recipientAgePoints: 15,
  ageUnknown: 5,
  oocyte: {
    coreMin: 23,
    coreMax: 35,
    corePoints: 20,
    extendedMin: 21,
    extendedMax: 37,
    extendedPoints: 12,
    elsePoints: 4,
  },
  semen: {
    coreMin: 21,
    coreMax: 40,
    corePoints: 20,
    extendedMin: 18,
    extendedMax: 45,
    extendedPoints: 12,
    elsePoints: 4,
  },
  response: { le1h: 10, le6h: 5, le24h: 2, elsePoints: 0 },
  tiers: { hot: 75, warm: 55, cold: 30 },
};

export const DEFAULT_SLA_MATRIX: SlaMatrix = {
  HOT: {
    responseHours: 2,
    completeHours: 24,
    escalationLadder: [
      { atPct: 25, notifyRole: "OPS_MANAGER" },
      { atPct: 50, notifyRole: "MARKETING_MANAGER" },
      { atPct: 100, notifyRole: "BANK_SUPER_ADMIN" },
    ],
  },
  WARM: {
    responseHours: 24,
    completeHours: 72,
    escalationLadder: [
      { atPct: 50, notifyRole: "OPS_MANAGER" },
      { atPct: 100, notifyRole: "MARKETING_MANAGER" },
    ],
  },
  COLD: {
    responseHours: 72,
    completeHours: 168,
    escalationLadder: [{ atPct: 100, notifyRole: "OPS_MANAGER" }],
  },
};

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  leadUnconvertedDays: 365,
};

export const DEFAULT_ASSIGNMENT_RULES: AssignmentRules = {
  maxQueuePerTelecaller: 20,
  autoAssignEnabled: true,
  openStatuses: [
    LeadStatus.NEW,
    LeadStatus.ASSIGNED,
    LeadStatus.CONTACTED_CALLBACK_REQUESTED,
    LeadStatus.NOT_REACHABLE,
    LeadStatus.COUNSELLING_BOOKED,
  ],
};

export const DEFAULT_FOLLOW_UP_POLICY = { defaultDueHours: 24 };
export const DEFAULT_COUNSELLING_POLICY = {
  defaultDurationMin: 30,
  reminderHours: [24, 2],
};
export const DEFAULT_NOTIFICATION_TEMPLATE_MAP = { templates: {} as Record<string, string> };
export const DEFAULT_CAMPAIGN_RULES = { enabled: false };
export const DEFAULT_DUPLICATE_MATCH_RULES = {
  phoneExact: true,
  emailExact: true,
  namePhoneFuzzy: true,
  nameEmailFuzzy: true,
};

export const CONFIG_DEFAULTS: Record<ConfigKey, Record<string, unknown>> = {
  [CONFIG_KEYS.SCORE_WEIGHTS_V1]: DEFAULT_SCORE_WEIGHTS,
  [CONFIG_KEYS.SLA_MATRIX_V1]: DEFAULT_SLA_MATRIX,
  [CONFIG_KEYS.RETENTION_POLICY_V1]: DEFAULT_RETENTION_POLICY,
  [CONFIG_KEYS.ASSIGNMENT_RULES_V1]: DEFAULT_ASSIGNMENT_RULES,
  [CONFIG_KEYS.FOLLOW_UP_POLICY_V1]: DEFAULT_FOLLOW_UP_POLICY,
  [CONFIG_KEYS.COUNSELLING_POLICY_V1]: DEFAULT_COUNSELLING_POLICY,
  [CONFIG_KEYS.NOTIFICATION_TEMPLATE_MAP_V1]: DEFAULT_NOTIFICATION_TEMPLATE_MAP,
  [CONFIG_KEYS.CAMPAIGN_RULES_V1]: DEFAULT_CAMPAIGN_RULES,
  [CONFIG_KEYS.DUPLICATE_MATCH_RULES_V1]: DEFAULT_DUPLICATE_MATCH_RULES,
};
