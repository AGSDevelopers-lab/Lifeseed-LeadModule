export type TimelineSourceType = "status_history" | "activity";

export type TimelineEntry = {
  id: string;
  sourceType: TimelineSourceType;
  occurredAt: string;
  actorUserId: string | null;
  actorName: string | null;
  summary: string;
  detail: string | null;
};

export type TimelinePage = {
  items: TimelineEntry[];
  nextCursor: string | null;
};

export type TimelineCursor = {
  occurredAt: string;
  sourceType: TimelineSourceType;
  id: string;
};

/** Locked order: occurredAt DESC, sourceType DESC, id DESC. */
export function compareTimelineKeys(
  a: { occurredAt: Date; sourceType: TimelineSourceType; id: string },
  b: { occurredAt: Date; sourceType: TimelineSourceType; id: string },
): number {
  const t = b.occurredAt.getTime() - a.occurredAt.getTime();
  if (t !== 0) return t;
  if (a.sourceType !== b.sourceType) return a.sourceType < b.sourceType ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

export function encodeTimelineCursor(c: TimelineCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export function decodeTimelineCursor(raw: string): TimelineCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const rec = parsed as Record<string, unknown>;
    if (typeof rec.occurredAt !== "string" || typeof rec.id !== "string") return null;
    if (rec.sourceType !== "status_history" && rec.sourceType !== "activity") return null;
    return { occurredAt: rec.occurredAt, sourceType: rec.sourceType, id: rec.id };
  } catch {
    return null;
  }
}

export function afterCursor(
  row: { occurredAt: Date; sourceType: TimelineSourceType; id: string },
  cursor: TimelineCursor,
): boolean {
  return (
    compareTimelineKeys(row, {
      occurredAt: new Date(cursor.occurredAt),
      sourceType: cursor.sourceType,
      id: cursor.id,
    }) > 0
  );
}
