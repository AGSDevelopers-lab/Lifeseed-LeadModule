import type { LeadActivity } from "../../domain/entities/LeadActivity";
import type { LeadActivityType, LeadChannel } from "../../domain/enums";
import { jsonRecord } from "./json";

export type PrismaActivityRow = {
  id: string;
  leadId: string;
  activityType: string;
  channel: string | null;
  actorUserId: string | null;
  actorRole: string | null;
  occurredAt: Date;
  summary: string | null;
  outcome: string | null;
  nextAction: string | null;
  nextActionDueAt: Date | null;
  metadata: unknown;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  auditRef: string | null;
  createdAt: Date;
};

export function activityToDomain(row: PrismaActivityRow): LeadActivity {
  return {
    id: row.id,
    leadId: row.leadId,
    activityType: row.activityType as LeadActivityType,
    channel: (row.channel as LeadChannel | null) ?? null,
    actorUserId: row.actorUserId,
    actorRole: row.actorRole,
    occurredAt: row.occurredAt,
    summary: row.summary,
    outcome: row.outcome,
    nextAction: row.nextAction,
    nextActionDueAt: row.nextActionDueAt,
    metadata: jsonRecord(row.metadata),
    relatedEntityType: row.relatedEntityType,
    relatedEntityId: row.relatedEntityId,
    auditRef: row.auditRef,
    createdAt: row.createdAt,
  };
}

export function activityToPrisma(entity: LeadActivity): PrismaActivityRow {
  return {
    id: entity.id,
    leadId: entity.leadId,
    activityType: entity.activityType,
    channel: entity.channel,
    actorUserId: entity.actorUserId,
    actorRole: entity.actorRole,
    occurredAt: entity.occurredAt,
    summary: entity.summary,
    outcome: entity.outcome,
    nextAction: entity.nextAction,
    nextActionDueAt: entity.nextActionDueAt,
    metadata: entity.metadata,
    relatedEntityType: entity.relatedEntityType,
    relatedEntityId: entity.relatedEntityId,
    auditRef: entity.auditRef,
    createdAt: entity.createdAt,
  };
}

export const toDomain = activityToDomain;
export const toPrisma = activityToPrisma;
