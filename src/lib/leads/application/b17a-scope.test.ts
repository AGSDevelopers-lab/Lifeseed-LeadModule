import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

const B11_B16 = [
  "src/lib/leads/application/follow-up.ts",
  "src/lib/leads/lead-assignment.ts",
  "src/lib/leads/application/duplicate.ts",
  "src/lib/leads/application/merge.ts",
  "src/lib/leads/application/crm-sync.ts",
];

describe("B17-A locked-scope preservation", () => {
  it("has zero prisma schema and migration diff vs HEAD", () => {
    const diff = execSync("git diff HEAD -- prisma/schema.prisma prisma/migrations", {
      cwd: root,
      encoding: "utf8",
    });
    expect(diff).toBe("");
  });

  it("does not modify core B12–B16 implementation files", () => {
    const diff = execSync(`git diff HEAD -- ${B11_B16.join(" ")}`, {
      cwd: root,
      encoding: "utf8",
    });
    expect(diff).toBe("");
  });

  it("does not add a second attribution store or CRM queue", () => {
    const attr = readFileSync(
      path.join(root, "src/lib/leads/application/lead-attribution-read.ts"),
      "utf8",
    );
    const crm = readFileSync(path.join(root, "src/lib/leads/application/lead-crm-status.ts"), "utf8");
    expect(attr).toMatch(/prisma\.leadAttribution\.findUnique/);
    expect(crm).toMatch(/prisma\.crmSyncQueue\.findMany/);
    expect(attr).not.toMatch(/create\(/);
    expect(crm).not.toMatch(/create\(/);
  });
});
