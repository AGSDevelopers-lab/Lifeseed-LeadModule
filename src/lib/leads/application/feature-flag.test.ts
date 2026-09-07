import { afterEach, describe, expect, it } from "vitest";

import { getLeadStateMachineMode, isLeadConversionPortEnabled, isLeadOutboxEnabled } from "./feature-flag";

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

describe("LEAD_OUTBOX_ENABLED", () => {
  it("defaults off unless the exact value on is set", () => {
    delete process.env.LEAD_OUTBOX_ENABLED;
    expect(isLeadOutboxEnabled({})).toBe(false);
    expect(isLeadOutboxEnabled({ LEAD_OUTBOX_ENABLED: "off" })).toBe(false);
    expect(isLeadOutboxEnabled({ LEAD_OUTBOX_ENABLED: "ON" })).toBe(false);
    expect(isLeadOutboxEnabled({ LEAD_OUTBOX_ENABLED: "on" })).toBe(true);
  });
});

describe("LEAD_CONVERSION_PORT_ENABLED", () => {
  it("defaults to off in production", () => {
    delete process.env.LEAD_CONVERSION_PORT_ENABLED;
    expect(isLeadConversionPortEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("defaults to on outside production", () => {
    delete process.env.LEAD_CONVERSION_PORT_ENABLED;
    expect(isLeadConversionPortEnabled({ NODE_ENV: "development" })).toBe(true);
  });
});
