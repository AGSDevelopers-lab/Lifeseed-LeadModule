import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LeadStatus } from "../domain/enums";
import { LeadOwnershipDeniedError } from "../domain/errors";
import { aLead } from "../testing/fixtures/aLead";

const applyLeadEvent = vi.fn(async () => ({ result: { nextStatus: "ASSIGNED" } })) as any;
const byId = vi.fn() as any;
const listAvailableTelecallers = vi.fn() as any;
const lookupUserSiteAndActive = vi.fn() as any;
const countAssignedOpenLeads = vi.fn(async () => 0) as any;

vi.mock("./apply-lead-event", () => ({
  applyLeadEvent: (...args: any[]) => applyLeadEvent(...args),
}));

vi.mock("../adapters/prisma-lead-repository", () => ({
  prismaLeadRepository: { byId: (...args: unknown[]) => byId(...args) },
  countAssignedOpenLeads: (...args: any[]) => countAssignedOpenLeads(...args),
}));

vi.mock("../adapters/prisma-assignment-directory", () => ({
  createPrismaAssignmentDirectory: async () => ({
    listAvailableTelecallers: (...args: any[]) => listAvailableTelecallers(...args),
  }),
  loadAssignmentRules: async () => ({
    maxQueuePerTelecaller: 20,
    autoAssignEnabled: true,
    openStatuses: ["NEW", "ASSIGNED"],
    siteMatchingPolicy: "require_match",
    crossSiteOverridePolicy: "assignment_override",
    rotationStrategy: "least_open_then_user_id",
  }),
  lookupUserSiteAndActive: (...args: any[]) => lookupUserSiteAndActive(...args),
}));

import { assignLeadToUser, reassignLeadToUser } from "./commands";
import { isLeadAssignmentV2Enabled } from "./feature-flag";
import { parseConfigPayload } from "../config/schemas";
import { CONFIG_KEYS } from "../config/keys";
import fs from "node:fs";
import path from "node:path";

describe("B13 commands + flag + config", () => {
  const env = { ...process.env };

  beforeEach(() => {
    applyLeadEvent.mockClear();
    byId.mockReset();
    listAvailableTelecallers.mockReset();
    lookupUserSiteAndActive.mockReset();
    countAssignedOpenLeads.mockReset();
    countAssignedOpenLeads.mockResolvedValue(0);
    process.env.LEAD_ASSIGNMENT_V2_ENABLED = "on";
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it("LEAD_ASSIGNMENT_V2_ENABLED defaults off", () => {
    delete process.env.LEAD_ASSIGNMENT_V2_ENABLED;
    expect(isLeadAssignmentV2Enabled({})).toBe(false);
    expect(isLeadAssignmentV2Enabled({ LEAD_ASSIGNMENT_V2_ENABLED: "on" })).toBe(true);
    expect(isLeadAssignmentV2Enabled({ LEAD_ASSIGNMENT_V2_ENABLED: "ON" })).toBe(false);
  });

  it("legacy ASSIGNMENT_RULES_V1 payloads still parse via SoD schema", () => {
    const parsed = parseConfigPayload(CONFIG_KEYS.ASSIGNMENT_RULES_V1, {
      maxQueuePerTelecaller: 20,
      autoAssignEnabled: true,
      openStatuses: ["NEW"],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const data = parsed.data as any;
      expect(data.siteMatchingPolicy).toBe("require_match");
      expect(data.crossSiteOverridePolicy).toBe("assignment_override");
      expect(data.rotationStrategy).toBe("least_open_then_user_id");
    }
  });

  it("feeds genuinely computed assigneeAvailable=false when the directory is empty", async () => {
    byId.mockResolvedValue(aLead({ status: LeadStatus.NEW, siteId: "s1" }));
    lookupUserSiteAndActive.mockResolvedValue({ siteId: "s1", isActive: true });
    listAvailableTelecallers.mockResolvedValue([]);
    await assignLeadToUser(
      "lead_1",
      { userId: "ops", roles: ["OPS_MANAGER"], siteId: "s1" },
      "tc1",
    );
    const facts = applyLeadEvent.mock.calls[0][0] as { facts: { assigneeAvailable: boolean } };
    expect(facts.facts.assigneeAvailable).toBe(false);
  });

  it("computes assigneeAvailable=true from a real directory candidate", async () => {
    byId.mockResolvedValue(aLead({ status: LeadStatus.NEW, siteId: "s1" }));
    lookupUserSiteAndActive.mockResolvedValue({ siteId: "s1", isActive: true });
    listAvailableTelecallers.mockResolvedValue([
      { userId: "tc1", siteId: "s1", openLeadCount: 1, languages: [], skills: [] },
    ]);
    await assignLeadToUser(
      "lead_1",
      { userId: "ops", roles: ["OPS_MANAGER"], siteId: "s1" },
      "tc1",
    );
    const facts = applyLeadEvent.mock.calls[0][0] as { facts: { assigneeAvailable: boolean } };
    expect(facts.facts.assigneeAvailable).toBe(true);
  });

  it("blocks cross-site assign without assignment.override when v2 is on", async () => {
    byId.mockResolvedValue(aLead({ status: LeadStatus.NEW, siteId: "s1" }));
    lookupUserSiteAndActive.mockResolvedValue({ siteId: "s2", isActive: true });
    await expect(
      assignLeadToUser(
        "lead_1",
        { userId: "mkt", roles: ["MARKETING_MANAGER"], siteId: "s1" },
        "tc-other",
      ),
    ).rejects.toBeInstanceOf(LeadOwnershipDeniedError);
    expect(applyLeadEvent).not.toHaveBeenCalled();
  });

  it("permits cross-site assign with assignment.override", async () => {
    byId.mockResolvedValue(aLead({ status: LeadStatus.NEW, siteId: "s1" }));
    lookupUserSiteAndActive.mockResolvedValue({ siteId: "s2", isActive: true });
    listAvailableTelecallers.mockResolvedValue([
      { userId: "tc-other", siteId: "s2", openLeadCount: 0, languages: [], skills: [] },
    ]);
    await assignLeadToUser(
      "lead_1",
      { userId: "ops", roles: ["OPS_MANAGER"], siteId: "s1" },
      "tc-other",
    );
    expect(applyLeadEvent).toHaveBeenCalled();
  });

  it("denies SR_TELECALLER reassignment outside own pool at the command boundary", async () => {
    byId.mockResolvedValue(
      aLead({ status: LeadStatus.ASSIGNED, assignedTelecallerId: "sr", siteId: "s1" }),
    );
    lookupUserSiteAndActive.mockResolvedValue({ siteId: "s2", isActive: true });
    await expect(
      reassignLeadToUser(
        "lead_1",
        { userId: "sr", roles: ["SR_TELECALLER"], siteId: "s1" },
        "tc-other",
        "cover",
      ),
    ).rejects.toBeInstanceOf(LeadOwnershipDeniedError);
    expect(applyLeadEvent).not.toHaveBeenCalled();
  });

  it("allows OPS_MANAGER reassignment across pools", async () => {
    process.env.LEAD_ASSIGNMENT_V2_ENABLED = "off";
    byId.mockResolvedValue(
      aLead({ status: LeadStatus.ASSIGNED, assignedTelecallerId: "tc1", siteId: "s1" }),
    );
    lookupUserSiteAndActive.mockResolvedValue({ siteId: "s2", isActive: true });
    listAvailableTelecallers.mockResolvedValue([
      { userId: "tc-other", siteId: "s2", openLeadCount: 0, languages: [], skills: [] },
    ]);
    await reassignLeadToUser(
      "lead_1",
      { userId: "ops", roles: ["OPS_MANAGER"], siteId: "s1" },
      "tc-other",
      "ops cover",
    );
    expect(applyLeadEvent).toHaveBeenCalled();
  });

  it("does not hardcode assigneeAvailable: true in commands.ts", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "commands.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/assigneeAvailable:\s*true/);
  });

  it("legacy round-robin path remains in lead-assignment.ts when flag is off", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../lead-assignment.ts"),
      "utf8",
    );
    expect(src).toMatch(/isLeadAssignmentV2Enabled/);
    expect(src).toMatch(/roles:\s*\{\s*some:\s*\{\s*role:\s*UserRole\.TELECALLER\s*\}\s*\}/);
  });
});
