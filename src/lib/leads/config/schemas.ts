import { z } from "zod";

import { CONFIG_KEYS, type ConfigKey } from "./keys";

const escalationStep = z.object({
  atPct: z.number(),
  notifyUserIds: z.array(z.string()).optional(),
  notifyRole: z.string().optional(),
});

export const scoreWeightsSchema = z.object({
  sourcePoints: z.record(z.string(), z.number()),
  serviceAreas: z.array(z.string()),
  supportedLanguages: z.array(z.string()),
  completenessMax: z.number(),
  locationInServiceArea: z.number(),
  locationOutOfArea: z.number(),
  languageSupported: z.number(),
  recipientAgePoints: z.number(),
  ageUnknown: z.number(),
  oocyte: z.object({
    coreMin: z.number(),
    coreMax: z.number(),
    corePoints: z.number(),
    extendedMin: z.number(),
    extendedMax: z.number(),
    extendedPoints: z.number(),
    elsePoints: z.number(),
  }),
  semen: z.object({
    coreMin: z.number(),
    coreMax: z.number(),
    corePoints: z.number(),
    extendedMin: z.number(),
    extendedMax: z.number(),
    extendedPoints: z.number(),
    elsePoints: z.number(),
  }),
  response: z.object({
    le1h: z.number(),
    le6h: z.number(),
    le24h: z.number(),
    elsePoints: z.number(),
  }),
  tiers: z.object({
    hot: z.number(),
    warm: z.number(),
    cold: z.number(),
  }),
});

export const slaMatrixSchema = z.object({
  HOT: z.object({
    responseHours: z.number(),
    completeHours: z.number().nullable(),
    escalationLadder: z.array(escalationStep),
  }),
  WARM: z.object({
    responseHours: z.number(),
    completeHours: z.number().nullable(),
    escalationLadder: z.array(escalationStep),
  }),
  COLD: z.object({
    responseHours: z.number(),
    completeHours: z.number().nullable(),
    escalationLadder: z.array(escalationStep),
  }),
});

export const retentionPolicySchema = z.object({
  leadUnconvertedDays: z.number().int().positive(),
});

export const assignmentRulesSchema = z.object({
  maxQueuePerTelecaller: z.number().int().positive(),
  autoAssignEnabled: z.boolean(),
  openStatuses: z.array(z.string()),
});

export const followUpPolicySchema = z.object({
  defaultDueHours: z.number(),
  /** Minutes after dueAt before DUE → OVERDUE. Absent in B09 seed ⇒ 0. */
  overdueGraceMinutes: z.number().nonnegative().optional(),
});

export const counsellingPolicySchema = z.object({
  defaultDurationMin: z.number(),
  reminderHours: z.array(z.number()),
});

export const notificationTemplateMapSchema = z.object({
  templates: z.record(z.string(), z.string()),
});

export const campaignRulesSchema = z.object({
  enabled: z.boolean(),
});

export const duplicateMatchRulesSchema = z.object({
  phoneExact: z.boolean(),
  emailExact: z.boolean(),
  namePhoneFuzzy: z.boolean(),
  nameEmailFuzzy: z.boolean(),
});

export const CONFIG_SCHEMAS: Record<ConfigKey, z.ZodType> = {
  [CONFIG_KEYS.SCORE_WEIGHTS_V1]: scoreWeightsSchema,
  [CONFIG_KEYS.SLA_MATRIX_V1]: slaMatrixSchema,
  [CONFIG_KEYS.RETENTION_POLICY_V1]: retentionPolicySchema,
  [CONFIG_KEYS.ASSIGNMENT_RULES_V1]: assignmentRulesSchema,
  [CONFIG_KEYS.FOLLOW_UP_POLICY_V1]: followUpPolicySchema,
  [CONFIG_KEYS.COUNSELLING_POLICY_V1]: counsellingPolicySchema,
  [CONFIG_KEYS.NOTIFICATION_TEMPLATE_MAP_V1]: notificationTemplateMapSchema,
  [CONFIG_KEYS.CAMPAIGN_RULES_V1]: campaignRulesSchema,
  [CONFIG_KEYS.DUPLICATE_MATCH_RULES_V1]: duplicateMatchRulesSchema,
};

export type ScoreWeights = z.infer<typeof scoreWeightsSchema>;
export type SlaMatrix = z.infer<typeof slaMatrixSchema>;
export type RetentionPolicy = z.infer<typeof retentionPolicySchema>;
export type AssignmentRules = z.infer<typeof assignmentRulesSchema>;

export function parseConfigPayload(key: ConfigKey, payload: unknown) {
  return CONFIG_SCHEMAS[key].safeParse(payload);
}
