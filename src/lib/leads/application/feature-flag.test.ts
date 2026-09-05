import { afterEach, describe, expect, it } from "vitest";

import { getLeadStateMachineMode } from "./feature-flag";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("LEAD_STATE_MACHINE_ENABLED", () => {
  it("defaults to off in production", () => {
    delete process.env.LEAD_STATE_MACHINE_ENABLED;
    expect(getLeadStateMachineMode({ NODE_ENV: "production" })).toBe("off");
  });

  it("defaults to shadow outside production", () => {
    delete process.env.LEAD_STATE_MACHINE_ENABLED;
    expect(getLeadStateMachineMode({ NODE_ENV: "development" })).toBe("shadow");
  });
});
