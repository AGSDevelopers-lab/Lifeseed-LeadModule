import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("P0-5 T-21/T-30 paths do not bypass the state machine", () => {
  const files = [
    "src/lib/leads/application/auto-transitions.ts",
    "src/app/api/leads/v2/internal/counselling/tick/route.ts",
    "src/app/api/leads/v2/internal/retention/purge/route.ts",
    "src/app/api/leads/purge-expired/route.ts",
  ];

  it("contains no applyAuthorizedLeadStatus and no prisma.lead.update", () => {
    for (const file of files) {
      const text = read(file);
      expect(text.includes("applyAuthorizedLeadStatus"), file).toBe(false);
      expect(text.includes("prisma.lead.update"), file).toBe(false);
    }
  });

  it("T-21 tick uses applyLeadEvent(mark_lost) with forcePersist", () => {
    const text = read("src/lib/leads/application/auto-transitions.ts");
    expect(text).toMatch(/event:\s*LeadEvent\.mark_lost/);
    expect(text).toMatch(/forcePersist:\s*true/);
    expect(text).toMatch(/expireLeadV2\(leadId,\s*actor,\s*\{\s*forcePersist:\s*true\s*\}\)/);
  });
});

/**
 * Classification only — BATCH 2 must not retire these writers (E-SM / BATCH 5).
 * applyAuthorizedLeadStatus call sites (production):
 * - src/lib/leads/adapters/prisma-lead-repository.ts applyAuthorizedLeadStatus itself
 * - src/lib/leads/lead-assignment.ts ASSIGNED (legacy assign when SM persist off)
 * - src/lib/leads/lead-conversion.ts CONVERTED (legacy convert)
 * - src/app/(portals)/leads/actions.ts disposition / counselling / archive / purge
 * SM persistBundle:
 * - src/lib/leads/adapters/prisma-transition-store.ts lead_patch.status
 */
describe("Lead.status writer inventory (classify, do not retire)", () => {
  it("legacy applyAuthorizedLeadStatus callers still exist", () => {
    const assignment = read("src/lib/leads/lead-assignment.ts");
    const conversion = read("src/lib/leads/lead-conversion.ts");
    const actions = read("src/app/(portals)/leads/actions.ts");
    expect(assignment.includes("applyAuthorizedLeadStatus")).toBe(true);
    expect(conversion.includes("applyAuthorizedLeadStatus")).toBe(true);
    expect(actions.includes("applyAuthorizedLeadStatus")).toBe(true);
  });
});
