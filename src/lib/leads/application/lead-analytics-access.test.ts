import { describe, expect, it } from "vitest";

import { canViewLeadAnalytics } from "./lead-analytics-access";

describe("B17-B analytics surface authorization", () => {
  it("allows lead.list holders", () => {
    expect(canViewLeadAnalytics({ roles: ["OPS_MANAGER"] })).toBe(true);
  });

  it("denies roles without marketing.analytics or lead.list", () => {
    expect(canViewLeadAnalytics({ roles: ["TELECALLER"] })).toBe(false);
  });
});
