import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("B16 locked-scope preservation", () => {
  it("has zero prisma schema and migration diff vs HEAD", () => {
    const diff = execSync("git diff HEAD -- prisma/schema.prisma prisma/migrations", {
      cwd: root,
      encoding: "utf8",
    });
    expect(diff).toBe("");
  });

  it("does not add crm.config.set", () => {
    const src = readFileSync(path.join(root, "src/lib/leads/application/crm-http.ts"), "utf8");
    expect(src).not.toMatch(/crm\.config\.set/);
  });

  it("retired System A src/lib/crm after canonical path landed", () => {
    expect(existsSync(path.join(root, "src/lib/crm/sync-queue.ts"))).toBe(false);
    expect(existsSync(path.join(root, "src/lib/crm/adapters/zoho-adapter.ts"))).toBe(false);
    expect(existsSync(path.join(root, "src/lib/crm/adapters/salesforce-adapter.ts"))).toBe(false);
  });

  it("create-lead no longer enqueues System A CRM", () => {
    const src = readFileSync(path.join(root, "src/lib/leads/create-lead.ts"), "utf8");
    expect(src).not.toMatch(/lib\/crm/);
    expect(src).toMatch(/emitLeadScoreChanged/);
  });

  it("does not implement Lead 360 / B17 surfaces", () => {
    const files = [
      "src/lib/leads/application/crm-sync.ts",
      "src/app/(portals)/admin/leads/crm/page.tsx",
    ];
    for (const rel of files) {
      const src = readFileSync(path.join(root, rel), "utf8");
      expect(src).not.toMatch(/LEAD_360_ENABLED|Lead 360 rebuild/);
    }
  });

  it("production callers set forcePersist for CRM-relevant events", () => {
    const commands = readFileSync(path.join(root, "src/lib/leads/application/commands.ts"), "utf8");
    expect(commands).toMatch(/export async function qualifyLead[\s\S]*forcePersist:\s*true/);
    expect(commands).toMatch(/export async function archiveLeadV2[\s\S]*forcePersist:\s*true/);
    expect(commands).toMatch(/export async function convertDonorStub[\s\S]*forcePersist:\s*true/);
    const intake = readFileSync(path.join(root, "src/lib/leads/application/intake.ts"), "utf8");
    expect(intake).toMatch(/stateMachinePersistsSideEffects\(mode\) \|\| forcePersist/);
  });
});
