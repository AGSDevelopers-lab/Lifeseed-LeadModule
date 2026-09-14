import { describe, expect, it } from "vitest";

import {
  buildLeadAuditWhere,
  decodeLeadAuditCursor,
  encodeLeadAuditCursor,
  LEAD_MODULE_AUDIT_ENTITY_TYPES,
} from "./lead-audit-query";

describe("B17-B lead-scoped audit read", () => {
  it("scopes to lead-module entity types only", () => {
    const where = buildLeadAuditWhere({});
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { entityType: { in: [...LEAD_MODULE_AUDIT_ENTITY_TYPES] } },
      ]),
    );
    expect(LEAD_MODULE_AUDIT_ENTITY_TYPES).not.toContain("Donor");
    expect(LEAD_MODULE_AUDIT_ENTITY_TYPES).not.toContain("Sample");
  });

  it("applies entityId, actorUserId, action, and date range independently", () => {
    const from = new Date("2026-09-01T00:00:00.000Z");
    const to = new Date("2026-09-14T00:00:00.000Z");
    const byLead = buildLeadAuditWhere({ entityId: "lead-1" });
    const byActor = buildLeadAuditWhere({ actorUserId: "user-1" });
    const byAction = buildLeadAuditWhere({ action: "CREATE" });
    const byDate = buildLeadAuditWhere({ from, to });
    expect(JSON.stringify(byLead)).toContain("lead-1");
    expect(JSON.stringify(byActor)).toContain("user-1");
    expect(JSON.stringify(byAction)).toContain("CREATE");
    expect(JSON.stringify(byDate)).toContain("2026-09-01");
  });

  it("uses opaque keyset cursor, not offset", () => {
    const cursor = encodeLeadAuditCursor({
      timestamp: "2026-09-14T00:00:00.000Z",
      id: "aud-9",
    });
    expect(decodeLeadAuditCursor(cursor)).toEqual({
      timestamp: "2026-09-14T00:00:00.000Z",
      id: "aud-9",
    });
    const where = buildLeadAuditWhere({ cursor });
    expect(JSON.stringify(where)).toContain("lt");
    expect(JSON.stringify(where)).not.toContain("skip");
    expect(JSON.stringify(where)).not.toContain("offset");
  });

  it("rejects invalid cursors", () => {
    expect(() => buildLeadAuditWhere({ cursor: "not-a-cursor" })).toThrow("INVALID_CURSOR");
  });
});
