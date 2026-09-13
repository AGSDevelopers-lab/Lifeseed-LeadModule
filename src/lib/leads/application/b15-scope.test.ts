import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

const B11_B14 = [
  "src/lib/leads/application/counselling.ts",
  "src/lib/leads/application/follow-up.ts",
  "src/lib/leads/lead-assignment.ts",
  "src/lib/leads/application/duplicate.ts",
  "src/lib/leads/application/merge.ts",
  "src/lib/leads/domain/duplicate/match-rules.ts",
];

describe("B15 locked-scope preservation", () => {
  it("has zero prisma schema and migration diff vs HEAD", () => {
    const diff = execSync("git diff HEAD -- prisma/schema.prisma prisma/migrations", {
      cwd: root,
      encoding: "utf8",
    });
    expect(diff).toBe("");
  });

  it("does not modify rbac-permissions.ts", () => {
    const diff = execSync("git diff HEAD -- src/lib/rbac-permissions.ts", {
      cwd: root,
      encoding: "utf8",
    });
    expect(diff).toBe("");
  });

  it("does not modify B11/B12/B13/B14 implementation files", () => {
    const diff = execSync(`git diff HEAD -- ${B11_B14.join(" ")}`, {
      cwd: root,
      encoding: "utf8",
    });
    expect(diff).toBe("");
  });

  it("wires captureTouch immediately after persistNewLead create, flag-gated", () => {
    const src = readFileSync(path.join(root, "src/lib/leads/create-lead.ts"), "utf8");
    expect(src).toMatch(/prisma\.lead\.create/);
    expect(src).toMatch(/isLeadAttributionEnabled/);
    expect(src).toMatch(/captureTouch/);
  });

  it("contains no HeldIntake / AdmissionOutcome / Lead 360 attribution card", () => {
    const files = [
      "src/lib/leads/application/attribution.ts",
      "src/lib/leads/application/campaign.ts",
      "src/app/(portals)/admin/leads/campaigns/page.tsx",
    ];
    for (const rel of files) {
      const src = readFileSync(path.join(root, rel), "utf8");
      expect(src).not.toMatch(/HeldIntake|AdmissionOutcome|Lead 360 Attribution/);
    }
  });
});
