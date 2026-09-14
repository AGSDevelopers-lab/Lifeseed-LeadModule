import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

import {
  compareTimelineKeys,
  decodeTimelineCursor,
  encodeTimelineCursor,
  type TimelineCursor,
  type TimelineEntry,
  type TimelinePage,
  type TimelineSourceType,
} from "./lead-timeline-cursor";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type RawRow = {
  id: string;
  sourceType: TimelineSourceType;
  occurredAt: Date;
  actorUserId: string | null;
  actorName: string | null;
  summary: string;
  detail: string | null;
};

function historyWhere(leadId: string, cursor: TimelineCursor | null): Prisma.LeadStatusHistoryWhereInput {
  if (!cursor) return { leadId };
  const t = new Date(cursor.occurredAt);
  if (cursor.sourceType === "activity") {
    return { leadId, occurredAt: { lt: t } };
  }
  return {
    leadId,
    OR: [{ occurredAt: { lt: t } }, { occurredAt: t, id: { lt: cursor.id } }],
  };
}

function activityWhere(leadId: string, cursor: TimelineCursor | null): Prisma.LeadActivityWhereInput {
  if (!cursor) return { leadId };
  const t = new Date(cursor.occurredAt);
  if (cursor.sourceType === "status_history") {
    return { leadId, occurredAt: { lte: t } };
  }
  return {
    leadId,
    OR: [{ occurredAt: { lt: t } }, { occurredAt: t, id: { lt: cursor.id } }],
  };
}

export async function listLeadTimeline(
  leadId: string,
  query: { cursor?: string | null; limit?: number | null },
): Promise<TimelinePage> {
  const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit ?? DEFAULT_LIMIT));
  const cursor = query.cursor ? decodeTimelineCursor(query.cursor) : null;
  if (query.cursor && !cursor) {
    throw new Error("INVALID_CURSOR");
  }

  const take = limit + 1;
  const [history, activities] = await Promise.all([
    prisma.leadStatusHistory.findMany({
      where: historyWhere(leadId, cursor),
      include: { actor: { select: { email: true } } },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take,
    }),
    prisma.leadActivity.findMany({
      where: activityWhere(leadId, cursor),
      include: { actor: { select: { email: true } } },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take,
    }),
  ]);

  const merged: RawRow[] = [
    ...history.map((h) => ({
      id: h.id,
      sourceType: "status_history" as const,
      occurredAt: h.occurredAt,
      actorUserId: h.actorUserId,
      actorName: h.actor?.email ?? null,
      summary: `${h.fromStatus ?? "∅"} → ${h.toStatus} (${h.event})`,
      detail: h.reason,
    })),
    ...activities.map((a) => ({
      id: a.id,
      sourceType: "activity" as const,
      occurredAt: a.occurredAt,
      actorUserId: a.actorUserId,
      actorName: a.actor?.email ?? null,
      summary: a.summary ?? a.activityType,
      detail: a.outcome,
    })),
  ];

  merged.sort(compareTimelineKeys);
  const page = merged.slice(0, limit);
  const hasMore = merged.length > limit;
  const last = page[page.length - 1];

  const items: TimelineEntry[] = page.map((row) => ({
    id: row.id,
    sourceType: row.sourceType,
    occurredAt: row.occurredAt.toISOString(),
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    summary: row.summary,
    detail: row.detail,
  }));

  return {
    items,
    nextCursor:
      hasMore && last
        ? encodeTimelineCursor({
            occurredAt: last.occurredAt.toISOString(),
            sourceType: last.sourceType,
            id: last.id,
          })
        : null,
  };
}
