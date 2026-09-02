import { SlaEntityType, type Prisma } from "@prisma/client";

export type EscalationStep = {
  atPct: number;
  notifyUserIds?: string[];
  notifyRole?: string;
};

export type SlaScheduleDefinition = {
  entityType: SlaEntityType;
  stageKey: string;
  responseHours: number;
  completeHours: number | null;
  escalationLadder: EscalationStep[];
};

export const SLA_DEFINITIONS: Record<string, SlaScheduleDefinition> = {
  lead_hot_response: {
    entityType: SlaEntityType.LEAD_RESPONSE,
    stageKey: "hot_lead_response",
    responseHours: 2,
    completeHours: 24,
    escalationLadder: [
      { atPct: 25, notifyRole: "OPS_MANAGER" },
      { atPct: 50, notifyRole: "MARKETING_MANAGER" },
      { atPct: 100, notifyRole: "BANK_SUPER_ADMIN" },
    ],
  },
  lead_warm_response: {
    entityType: SlaEntityType.LEAD_RESPONSE,
    stageKey: "warm_lead_response",
    responseHours: 24,
    completeHours: 72,
    escalationLadder: [
      { atPct: 50, notifyRole: "OPS_MANAGER" },
      { atPct: 100, notifyRole: "MARKETING_MANAGER" },
    ],
  },
  lead_cold_response: {
    entityType: SlaEntityType.LEAD_RESPONSE,
    stageKey: "cold_lead_response",
    responseHours: 72,
    completeHours: 168,
    escalationLadder: [{ atPct: 100, notifyRole: "OPS_MANAGER" }],
  },
  counselling_reminder_24h: {
    entityType: SlaEntityType.COUNSELLING_REMINDER,
    stageKey: "counselling_reminder_24h",
    responseHours: 24,
    completeHours: null,
    escalationLadder: [],
  },
  counselling_reminder_2h: {
    entityType: SlaEntityType.COUNSELLING_REMINDER,
    stageKey: "counselling_reminder_2h",
    responseHours: 2,
    completeHours: null,
    escalationLadder: [],
  },
  donor_screening_7d: {
    entityType: SlaEntityType.DONOR_SCREENING,
    stageKey: "donor_screening_complete",
    responseHours: 168,
    completeHours: 168,
    escalationLadder: [{ atPct: 100, notifyRole: "BANK_DONOR_COORD" }],
  },
  donor_consent_48h: {
    entityType: SlaEntityType.DONOR_CONSENT,
    stageKey: "donor_consent_complete",
    responseHours: 48,
    completeHours: 48,
    escalationLadder: [{ atPct: 100, notifyRole: "BANK_DONOR_COORD" }],
  },
  embryology_outcome_14d: {
    entityType: SlaEntityType.EMBRYOLOGY_OUTCOME,
    stageKey: "embryology_outcome_14d",
    responseHours: 14 * 24,
    completeHours: null,
    escalationLadder: [],
  },
  embryology_outcome_30d: {
    entityType: SlaEntityType.EMBRYOLOGY_OUTCOME,
    stageKey: "embryology_outcome_30d",
    responseHours: 30 * 24,
    completeHours: null,
    escalationLadder: [],
  },
  embryology_outcome_90d: {
    entityType: SlaEntityType.EMBRYOLOGY_OUTCOME,
    stageKey: "embryology_outcome_90d",
    responseHours: 90 * 24,
    completeHours: null,
    escalationLadder: [],
  },
  embryology_outcome_180d: {
    entityType: SlaEntityType.EMBRYOLOGY_OUTCOME,
    stageKey: "embryology_outcome_180d",
    responseHours: 180 * 24,
    completeHours: null,
    escalationLadder: [],
  },
};

export function defineSla(
  entityType: SlaEntityType,
  stageKey: string,
  responseHours: number,
  completeHours: number | null,
  escalationLadder: EscalationStep[],
): SlaScheduleDefinition {
  return { entityType, stageKey, responseHours, completeHours, escalationLadder };
}

export function leadSlaKeyForTier(tier: string): string {
  if (tier === "HOT") return "lead_hot_response";
  if (tier === "WARM") return "lead_warm_response";
  return "lead_cold_response";
}

export type EscalationLadderJson = EscalationStep[];

export function ladderToJson(
  ladder: EscalationStep[],
): Prisma.InputJsonValue {
  return ladder as unknown as Prisma.InputJsonValue;
}
