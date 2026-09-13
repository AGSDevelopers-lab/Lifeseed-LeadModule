import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/leads/application/apply-lead-event", () => ({
  applyLeadEvent: vi.fn(async (input: { event: string; permission: string; payload?: { cancelMode?: string } }) => ({
    result: { id: "T-mock", event: input.event, permission: input.permission, payload: input.payload },
  })),
}));

import { applyLeadEvent } from "@/lib/leads/application/apply-lead-event";
import {
  bookCounsellingSession,
  cancelCounsellingBooking,
  recordCounsellingOutcome,
  recordCounsellingSession,
  rescheduleCounsellingBooking,
} from "@/lib/leads/application/counselling";
import { ROLE_PERMISSIONS, permissionGranted } from "@/lib/rbac-permissions";
import { isLeadCounsellingHistoryEnabled } from "@/lib/leads/application/feature-flag";

const actor = { userId: "u1", roles: ["TELECALLER"], siteId: "s1" };

describe("B11 counselling application", () => {
  it("books through SM counselling.book", async () => {
    await bookCounsellingSession("lead-1", actor, {
      counsellorUserId: "c1",
      scheduledAt: new Date("2026-09-20T10:00:00.000Z"),
    });
    expect(applyLeadEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: "lead-1",
        event: "book_counselling",
        permission: "counselling.book",
        forcePersist: true,
      }),
    );
  });

  it("reschedules as distinct action with counselling.reschedule", async () => {
    await rescheduleCounsellingBooking("lead-1", actor, {
      scheduledAt: new Date("2026-09-21T10:00:00.000Z"),
      counsellorUserId: "c1",
    });
    expect(applyLeadEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "session_cancelled",
        permission: "counselling.reschedule",
        payload: expect.objectContaining({ cancelMode: "reschedule" }),
        forcePersist: true,
      }),
    );
  });

  it("cancels as distinct action with counselling.cancel", async () => {
    await cancelCounsellingBooking("lead-1", actor, { reason: "lead request" });
    expect(applyLeadEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "session_cancelled",
        permission: "counselling.cancel",
        payload: expect.objectContaining({ cancelMode: "full" }),
      }),
    );
  });

  it("records session through SM", async () => {
    await recordCounsellingSession("lead-1", actor, "attended", { notes: "ok" });
    expect(applyLeadEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "session_attended",
        permission: "counselling.session.record",
        forcePersist: true,
      }),
    );
  });

  it("records outcome through SM without a correction API", async () => {
    await recordCounsellingOutcome("lead-1", actor, {
      recommendation: "DEFER",
      notes: "wait",
    });
    expect(applyLeadEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: "counselling.outcome.record",
        payload: expect.objectContaining({ recommendation: "DEFER" }),
      }),
    );
  });
});

describe("B11 counselling RBAC grants", () => {
  const viewRoles = [
    "TELECALLER",
    "SR_TELECALLER",
    "COUNSELLOR",
    "OPS_MANAGER",
    "BANK_SUPER_ADMIN",
  ] as const;
  const denied = ["MARKETING_MANAGER", "CRM_ADMIN", "BANK_MEDICAL_DIRECTOR"] as const;

  it("grants counselling.view to intended roles only", () => {
    for (const role of viewRoles) {
      expect(permissionGranted(ROLE_PERMISSIONS[role], "counselling.view")).toBe(true);
    }
    for (const role of denied) {
      expect(permissionGranted(ROLE_PERMISSIONS[role], "counselling.view")).toBe(false);
    }
  });

  it("grants telecaller reschedule and cancel", () => {
    expect(permissionGranted(ROLE_PERMISSIONS.TELECALLER, "counselling.reschedule")).toBe(true);
    expect(permissionGranted(ROLE_PERMISSIONS.TELECALLER, "counselling.cancel")).toBe(true);
    expect(permissionGranted(ROLE_PERMISSIONS.SR_TELECALLER, "counselling.reschedule")).toBe(true);
    expect(permissionGranted(ROLE_PERMISSIONS.SR_TELECALLER, "counselling.cancel")).toBe(true);
  });

  it("does not create counselling.session.cancel", () => {
    for (const role of Object.keys(ROLE_PERMISSIONS)) {
      expect(
        permissionGranted(ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS], "counselling.session.cancel"),
      ).toBe(false);
    }
  });
});

describe("LEAD_COUNSELLING_HISTORY_ENABLED", () => {
  it("defaults ON including production", () => {
    expect(isLeadCounsellingHistoryEnabled({ NODE_ENV: "production" })).toBe(true);
    expect(isLeadCounsellingHistoryEnabled({})).toBe(true);
  });

  it("turns off only for exact off", () => {
    expect(isLeadCounsellingHistoryEnabled({ LEAD_COUNSELLING_HISTORY_ENABLED: "off" })).toBe(false);
    expect(isLeadCounsellingHistoryEnabled({ LEAD_COUNSELLING_HISTORY_ENABLED: "on" })).toBe(true);
  });
});
