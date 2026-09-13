import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("B15 Campaign Manager + CAC UI", () => {
  it("Campaign Manager page renders CRUD/lifecycle controls", () => {
    const page = readFileSync(
      path.join(root, "src/app/(portals)/admin/leads/campaigns/page.tsx"),
      "utf8",
    );
    const client = readFileSync(
      path.join(root, "src/app/(portals)/admin/leads/campaigns/campaigns-client.tsx"),
      "utf8",
    );
    expect(page).toMatch(/campaign\.view/);
    expect(page).toMatch(/Campaign Manager/);
    expect(client).toMatch(/Create campaign/);
    expect(client).toMatch(/Activate/);
    expect(client).toMatch(/Pause/);
    expect(client).toMatch(/End/);
    expect(client).toMatch(/\/api\/leads\/v2\/campaigns/);
  });

  it("analytics page CAC extension renders computed values not placeholder copy", () => {
    const src = readFileSync(
      path.join(root, "src/app/(portals)/admin/leads/analytics/page.tsx"),
      "utf8",
    );
    expect(src).toMatch(/computeCampaignCac/);
    expect(src).toMatch(/CAC \(last-touch, INR\)/);
    expect(src).not.toMatch(/CAC placeholders/);
    expect(src).not.toMatch(/not wired in v1/);
  });
});
