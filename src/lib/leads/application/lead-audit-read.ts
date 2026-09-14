import { prisma } from "@/lib/db";
import { redactAuditJson } from "@/lib/pii-redact";

import {
  buildLeadAuditWhere,
  decodeLeadAuditCursor,
  encodeLeadAuditCursor,
  type LeadAuditFilters,
} from "./lead-audit-query";

export {
  buildLeadAuditWhere,
  decodeLeadAuditCursor,
  encodeLeadAuditCursor,
  LEAD_MODULE_AUDIT_ENTITY_TYPES,
  type LeadAuditCursor,
  type LeadAuditFilters,
} from "./lead-audit-query";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function listLeadAudit(filters: LeadAuditFilters) {
  const limit = Math.min(MAX_LIMIT, Math.max(1, filters.limit ?? DEFAULT_LIMIT));
  if (filters.cursor && !decodeLeadAuditCursor(filters.cursor)) {
    throw new Error("INVALID_CURSOR");
  }
  const where = buildLeadAuditWhere(filters);
  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  const extra = rows[limit];
  const last = page[page.length - 1];
  return {
    items: page.map((r) => ({
      id: r.id,
      timestamp: r.timestamp.toISOString(),
      actorUserId: r.actorUserId,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      beforeJson: redactAuditJson(r.beforeJson),
      afterJson: redactAuditJson(r.afterJson),
    })),
    nextCursor:
      extra && last
        ? encodeLeadAuditCursor({
            timestamp: last.timestamp.toISOString(),
            id: last.id,
          })
        : null,
  };
}
