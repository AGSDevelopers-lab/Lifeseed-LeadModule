import { UserRole } from "@prisma/client";

export const CONFIG_KEYS = {
  SCORE_WEIGHTS_V1: "SCORE_WEIGHTS_V1",
  SLA_MATRIX_V1: "SLA_MATRIX_V1",
  RETENTION_POLICY_V1: "RETENTION_POLICY_V1",
  ASSIGNMENT_RULES_V1: "ASSIGNMENT_RULES_V1",
  FOLLOW_UP_POLICY_V1: "FOLLOW_UP_POLICY_V1",
  COUNSELLING_POLICY_V1: "COUNSELLING_POLICY_V1",
  NOTIFICATION_TEMPLATE_MAP_V1: "NOTIFICATION_TEMPLATE_MAP_V1",
  CAMPAIGN_RULES_V1: "CAMPAIGN_RULES_V1",
  DUPLICATE_MATCH_RULES_V1: "DUPLICATE_MATCH_RULES_V1",
} as const;

export type ConfigKey = (typeof CONFIG_KEYS)[keyof typeof CONFIG_KEYS];

export const CONFIG_KEY_LIST = Object.values(CONFIG_KEYS);

/**
 * Owner role per 05_LEAD_API_RBAC.md §4.3 (O-02 still open; remaining keys
 * follow the same Ops vs Marketing split).
 */
export const CONFIG_OWNER_ROLE: Record<ConfigKey, UserRole> = {
  SCORE_WEIGHTS_V1: UserRole.MARKETING_MANAGER,
  SLA_MATRIX_V1: UserRole.OPS_MANAGER,
  RETENTION_POLICY_V1: UserRole.OPS_MANAGER,
  ASSIGNMENT_RULES_V1: UserRole.OPS_MANAGER,
  FOLLOW_UP_POLICY_V1: UserRole.OPS_MANAGER,
  COUNSELLING_POLICY_V1: UserRole.OPS_MANAGER,
  NOTIFICATION_TEMPLATE_MAP_V1: UserRole.MARKETING_MANAGER,
  CAMPAIGN_RULES_V1: UserRole.MARKETING_MANAGER,
  DUPLICATE_MATCH_RULES_V1: UserRole.OPS_MANAGER,
};

export const CONFIG_LABELS: Record<ConfigKey, string> = {
  SCORE_WEIGHTS_V1: "Score weights",
  SLA_MATRIX_V1: "SLA matrix",
  RETENTION_POLICY_V1: "Retention policy",
  ASSIGNMENT_RULES_V1: "Assignment rules",
  FOLLOW_UP_POLICY_V1: "Follow-up policy",
  COUNSELLING_POLICY_V1: "Counselling policy",
  NOTIFICATION_TEMPLATE_MAP_V1: "Notification template map",
  CAMPAIGN_RULES_V1: "Campaign rules",
  DUPLICATE_MATCH_RULES_V1: "Duplicate match rules",
};

export function isConfigKey(value: string): value is ConfigKey {
  return (CONFIG_KEY_LIST as string[]).includes(value);
}

export function payloadSchemaRefFor(key: ConfigKey): string {
  return `${key}@1`;
}
