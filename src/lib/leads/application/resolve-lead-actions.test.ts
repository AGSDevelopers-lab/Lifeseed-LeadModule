import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  prisma: {
    counsellingBooking: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { aLead } from "../testing/fixtures/aLead";
import { LeadPersonType, LeadStatus } from "../domain/enums";
import { LEAD_360_ACTION_IDS, resolveLeadActions } from "./resolve-lead-actions";
import {
  COUNSELLING_CANCEL_PERMISSION,
  COUNSELLING_RESCHEDULE_PERMISSION,
} from "./counselling-permissions";
import { actorHasPerm } from "./guard-facts";

const findFirst = prisma.counsellingBooking.findFirst as ReturnType<typeof vi.fn>;
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("resolveLeadActions closed catalogue", () => {
  beforeEach(() => {
    findFirst.mockResolvedValue(null);
  });

  it("never emits a sixth action id", async () => {
    const lead = aLead({ status: LeadStatus.CONTACTED_QUALIFIED, personType: LeadPersonType.DONOR });
    const actions = await resolveLeadActions(lead, {
      userId: "u1",
      roles: ["BANK_SUPER_ADMIN"],
      siteId: null,
    });
    expect(LEAD_360_ACTION_IDS).toHaveLength(5);
    expect(actions.every((a) => (LEAD_360_ACTION_IDS as readonly string[]).includes(a.id))).toBe(
      true,
    );
    expect(new Set(actions.map((a) => a.id)).size).toBe(actions.length);
  });

  it("omits ARCHIVE_LEAD for terminal LOST / CONVERTED / EXPIRED_AUTO_PURGED", async () => {
    for (const status of [LeadStatus.LOST, LeadStatus.CONVERTED, LeadStatus.EXPIRED_AUTO_PURGED]) {
      const actions = await resolveLeadActions(aLead({ status }), {
        userId: "u1",
        roles: ["OPS_MANAGER"],
        siteId: null,
      });
      expect(actions.map((a) => a.id)).not.toContain("ARCHIVE_LEAD");
    }
  });

  it("offers ARCHIVE_LEAD when t27Archive + lead.archive succeed", async () => {
    const actions = await resolveLeadActions(aLead({ status: LeadStatus.ASSIGNED }), {
      userId: "u1",
      roles: ["OPS_MANAGER"],
      siteId: null,
    });
    expect(actions.map((a) => a.id)).toContain("ARCHIVE_LEAD");
  });

  it("omits ARCHIVE_LEAD without lead.archive permission", async () => {
    const actions = await resolveLeadActions(aLead({ status: LeadStatus.ASSIGNED }), {
      userId: "u1",
      roles: ["TELECALLER"],
      siteId: null,
    });
    expect(actions.map((a) => a.id)).not.toContain("ARCHIVE_LEAD");
  });

  it("offers convert donor only from convertible donor statuses", async () => {
    const ok = await resolveLeadActions(
      aLead({ status: LeadStatus.CONTACTED_QUALIFIED, personType: LeadPersonType.DONOR }),
      { userId: "u1", roles: ["OPS_MANAGER"], siteId: null },
    );
    const no = await resolveLeadActions(
      aLead({ status: LeadStatus.NEW, personType: LeadPersonType.DONOR }),
      { userId: "u1", roles: ["OPS_MANAGER"], siteId: null },
    );
    expect(ok.map((a) => a.id)).toContain("CONVERT_TO_DONOR");
    expect(no.map((a) => a.id)).not.toContain("CONVERT_TO_DONOR");
  });

  it("offers counselling actions only when booked and booking is in the future", async () => {
    findFirst.mockResolvedValue({
      id: "b1",
      scheduledAt: new Date(Date.now() + 86_400_000),
      bookingStatus: "SCHEDULED",
    });
    const actions = await resolveLeadActions(
      aLead({ status: LeadStatus.COUNSELLING_BOOKED }),
      { userId: "u1", roles: ["TELECALLER"], siteId: null },
    );
    expect(actions.map((a) => a.id)).toEqual(
      expect.arrayContaining(["RESCHEDULE_COUNSELLING", "CANCEL_COUNSELLING"]),
    );
  });

  it("authorizes counselling actions through the canonical imported constants", async () => {
    const counselling = readFileSync(
      path.join(root, "src/lib/leads/application/counselling.ts"),
      "utf8",
    );
    const resolver = readFileSync(
      path.join(root, "src/lib/leads/application/resolve-lead-actions.ts"),
      "utf8",
    );
    expect(counselling).toMatch(/from "\.\/counselling-permissions"/);
    expect(counselling).toMatch(/permission: COUNSELLING_RESCHEDULE_PERMISSION/);
    expect(counselling).toMatch(/permission: COUNSELLING_CANCEL_PERMISSION/);
    expect(counselling).not.toMatch(/permission: "counselling\.reschedule"/);
    expect(counselling).not.toMatch(/permission: "counselling\.cancel"/);
    expect(resolver).toMatch(/from "\.\/counselling-permissions"/);
    expect(resolver).toMatch(/COUNSELLING_RESCHEDULE_PERMISSION/);
    expect(resolver).toMatch(/COUNSELLING_CANCEL_PERMISSION/);
    expect(LEAD_360_ACTION_IDS).toEqual([
      "ARCHIVE_LEAD",
      "RESCHEDULE_COUNSELLING",
      "CANCEL_COUNSELLING",
      "CONVERT_TO_DONOR",
      "CONVERT_TO_RECIPIENT",
    ]);
    const ops = { userId: "u1", roles: ["OPS_MANAGER"], siteId: null };
    const marketing = { userId: "u2", roles: ["MARKETING_MANAGER"], siteId: null };
    expect(await actorHasPerm(ops, COUNSELLING_RESCHEDULE_PERMISSION)).toBe(true);
    expect(await actorHasPerm(ops, COUNSELLING_CANCEL_PERMISSION)).toBe(true);
    expect(await actorHasPerm(marketing, COUNSELLING_RESCHEDULE_PERMISSION)).toBe(false);
    expect(await actorHasPerm(marketing, COUNSELLING_CANCEL_PERMISSION)).toBe(false);
  });
});
