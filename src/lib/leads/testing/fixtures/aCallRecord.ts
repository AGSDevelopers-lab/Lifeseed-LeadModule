import type { CallRecord } from "../../domain/entities/CallRecord";

export function aCallRecord(overrides: Partial<CallRecord> = {}): CallRecord {
  return {
    id: "call_1",
    leadId: "lead_1",
    activityId: null,
    telecallerUserId: "user_tc",
    startedAt: new Date("2026-09-04T10:00:00.000Z"),
    endedAt: new Date("2026-09-04T10:05:00.000Z"),
    durationSec: 300,
    dispositionType: "CONTACTED_QUALIFIED",
    notes: null,
    followUpId: null,
    createdAt: new Date("2026-09-04T10:05:00.000Z"),
    ...overrides,
  };
}
