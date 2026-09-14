import type { Prisma } from "@prisma/client";

/** Lead-module entityType values written by the audited Prisma extension. */
export const LEAD_MODULE_AUDIT_ENTITY_TYPES = [
  "Lead",
  "LeadActivity",
  "LeadAssignment",
  "LeadFollowUp",
  "LeadConversion",
  "LeadStatusHistory",
  "LeadAttribution",
  "LeadAttributionHistory",
  "DuplicateCase",
  "LeadMerge",
  "CallDisposition",
  "CounsellingBooking",
  "CounsellingSession",
  "CounsellingOutcome",
  "LeadDoNotCall",
  "LeadScore",
  "Campaign",
  "LeadConfig",
  "LeadOutboxEvent",
  "LeadOutboxDlq",
  "LeadCodeSequence",
] as const;

export type LeadAuditFilters = {
  entityId?: string;
  actorUserId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  cursor?: string | null;
  limit?: number;
};

export type LeadAuditCursor = { timestamp: string; id: string };

export function encodeLeadAuditCursor(c: LeadAuditCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export function decodeLeadAuditCursor(raw: string): LeadAuditCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const rec = parsed as Record<string, unknown>;
    if (typeof rec.timestamp !== "string" || typeof rec.id !== "string") return null;
    return { timestamp: rec.timestamp, id: rec.id };
  } catch {
    return null;
  }
}

export function buildLeadAuditWhere(filters: LeadAuditFilters): Prisma.AuditLogWhereInput {
  const AND: Prisma.AuditLogWhereInput[] = [
    { entityType: { in: [...LEAD_MODULE_AUDIT_ENTITY_TYPES] } },
  ];
  if (filters.entityId) AND.push({ entityId: filters.entityId });
  if (filters.actorUserId) AND.push({ actorUserId: filters.actorUserId });
  if (filters.action) AND.push({ action: filters.action });
  if (filters.from || filters.to) {
    AND.push({
      timestamp: {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      },
    });
  }
  const cursor = filters.cursor ? decodeLeadAuditCursor(filters.cursor) : null;
  if (filters.cursor && !cursor) {
    throw new Error("INVALID_CURSOR");
  }
  if (cursor) {
    const t = new Date(cursor.timestamp);
    AND.push({
      OR: [
        { timestamp: { lt: t } },
        { timestamp: t, id: { lt: cursor.id } },
      ],
    });
  }
  return { AND };
}
