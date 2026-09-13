import { describe, expect, it } from "vitest";

import {
  assertSrTelecallerOwnPool,
  computeAssigneeAvailable,
  eligibleCandidates,
  pickFairRotate,
  siteMatchesCandidate,
} from "./assignment-policy";
import { DEFAULT_ASSIGNMENT_RULES } from "../config/defaults";
import { LeadOwnershipDeniedError } from "../domain/errors";
import type { TelecallerAvailability } from "../domain/ports/AssignmentDirectory";

const rules = DEFAULT_ASSIGNMENT_RULES;

function tc(
  userId: string,
  siteId: string | null,
  openLeadCount: number,
): TelecallerAvailability {
  return { userId, siteId, openLeadCount, languages: [], skills: [] };
}

describe("B13 assignment policy (site + capacity + active eligibility)", () => {
  it("matches site unless override", () => {
    expect(siteMatchesCandidate("s1", "s1", false, rules)).toBe(true);
    expect(siteMatchesCandidate("s2", "s1", false, rules)).toBe(false);
    expect(siteMatchesCandidate("s2", "s1", true, rules)).toBe(true);
  });

  it("treats a lead with no site as matchable without fabricating IAM data", () => {
    expect(siteMatchesCandidate("s1", null, false, rules)).toBe(true);
  });

  it("capacity guard excludes overloaded telecallers", () => {
    const listed = [tc("a", "s1", 20), tc("b", "s1", 3)];
    const eligible = eligibleCandidates(listed, "s1", false, {
      ...rules,
      maxQueuePerTelecaller: 20,
    });
    expect(eligible.map((e) => e.userId)).toEqual(["b"]);
  });

  it("computes assigneeAvailable from directory rows, not a hardcoded true", () => {
    expect(computeAssigneeAvailable([], "s1", false, rules)).toBe(false);
    expect(computeAssigneeAvailable([tc("a", "s1", 0)], "s1", false, rules)).toBe(true);
    expect(computeAssigneeAvailable([tc("a", "s2", 0)], "s1", false, rules)).toBe(false);
    expect(computeAssigneeAvailable([tc("a", "s2", 0)], "s1", true, rules)).toBe(true);
  });

  it("returns empty languages/skills on fallback rows (not fabricated)", () => {
    const row = tc("a", "s1", 0);
    expect([...row.languages]).toEqual([]);
    expect([...row.skills]).toEqual([]);
  });

  it("fair-rotates within site+capacity+active bucket within ±10%", () => {
    const counts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
    const ids = Object.keys(counts);
    for (let i = 0; i < 40; i += 1) {
      const listed = ids.map((id) => tc(id, "s1", counts[id]));
      const pick = pickFairRotate(eligibleCandidates(listed, "s1", false, rules));
      expect(pick).toBeTruthy();
      counts[pick!] += 1;
    }
    const values = Object.values(counts);
    const avg = values.reduce((s, n) => s + n, 0) / values.length;
    for (const n of values) {
      expect(n).toBeLessThanOrEqual(avg * 1.1 + 1e-9);
      expect(n).toBeGreaterThanOrEqual(avg * 0.9 - 1e-9);
    }
  });

  it("denies SR_TELECALLER reassignment outside own site pool", () => {
    expect(() =>
      assertSrTelecallerOwnPool(
        { userId: "sr", roles: ["SR_TELECALLER"], siteId: "s1" },
        "s2",
      ),
    ).toThrow(LeadOwnershipDeniedError);
  });

  it("allows SR_TELECALLER reassignment inside own site pool", () => {
    expect(() =>
      assertSrTelecallerOwnPool(
        { userId: "sr", roles: ["SR_TELECALLER"], siteId: "s1" },
        "s1",
      ),
    ).not.toThrow();
  });

  it("does not constrain OPS_MANAGER or BANK_SUPER_ADMIN reassignment", () => {
    expect(() =>
      assertSrTelecallerOwnPool(
        { userId: "ops", roles: ["OPS_MANAGER"], siteId: "s1" },
        "s2",
      ),
    ).not.toThrow();
    expect(() =>
      assertSrTelecallerOwnPool(
        { userId: "bsa", roles: ["BANK_SUPER_ADMIN"], siteId: "s1" },
        "s2",
      ),
    ).not.toThrow();
  });
});
