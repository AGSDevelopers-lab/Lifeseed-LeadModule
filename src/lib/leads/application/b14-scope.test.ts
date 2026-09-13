import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("B14 locked-scope preservation", () => {
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

  it("contains no HeldIntake / AdmissionOutcome / LEAD_HELD_INTAKE artifacts in B14 files", () => {
    const files = [
      "src/lib/leads/application/duplicate.ts",
      "src/lib/leads/application/merge.ts",
      "src/lib/leads/domain/duplicate/match-rules.ts",
      "src/lib/leads/application/feature-flag.ts",
    ];
    for (const rel of files) {
      const src = readFileSync(path.join(root, rel), "utf8");
      expect(src).not.toMatch(/HeldIntake|AdmissionOutcome|LEAD_HELD_INTAKE|STOP-3/);
    }
  });

  it("wires intake after persistNewLead", () => {
    const src = readFileSync(path.join(root, "src/lib/leads/create-lead.ts"), "utf8");
    expect(src).toMatch(/detectAndCreateDuplicateCases/);
    expect(src).toMatch(/isLeadDuplicateEnabled/);
  });
});
