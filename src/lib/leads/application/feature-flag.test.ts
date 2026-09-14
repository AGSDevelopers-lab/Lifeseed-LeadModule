import { afterEach, describe, expect, it } from "vitest";

import { getLeadStateMachineMode, getLeadNotificationPortMode, isLeadAssignmentV2Enabled, isLeadAttributionEnabled, isLeadConversionPortEnabled, isLeadDuplicateEnabled, isLeadFollowUpEnabled, isLeadOutboxEnabled, isLeadSmsEnabled, isLeadEmailEnabled, isLeadWhatsappEnabled, isLead360Enabled } from "./feature-flag";
import { getLeadConfigMode } from "../config/flag";

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

describe("LEAD_NOTIFICATION_PORT_ENABLED", () => {
  it("defaults to in_app_only", () => {
    delete process.env.LEAD_NOTIFICATION_PORT_ENABLED;
    expect(getLeadNotificationPortMode({})).toBe("in_app_only");
  });

  it("accepts off | in_app_only | on", () => {
    expect(getLeadNotificationPortMode({ LEAD_NOTIFICATION_PORT_ENABLED: "off" })).toBe("off");
    expect(getLeadNotificationPortMode({ LEAD_NOTIFICATION_PORT_ENABLED: "on" })).toBe("on");
  });
});

describe("LEAD_FOLLOWUP_ENABLED", () => {
  it("defaults to off in production", () => {
    delete process.env.LEAD_FOLLOWUP_ENABLED;
    expect(isLeadFollowUpEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("defaults to on outside production", () => {
    delete process.env.LEAD_FOLLOWUP_ENABLED;
    expect(isLeadFollowUpEnabled({ NODE_ENV: "development" })).toBe(true);
  });
});

describe("LEAD_CONFIG_ENABLED", () => {
  it("defaults to off in production", () => {
    delete process.env.LEAD_CONFIG_ENABLED;
    expect(getLeadConfigMode({ NODE_ENV: "production" })).toBe("off");
  });

  it("defaults to partial outside production", () => {
    delete process.env.LEAD_CONFIG_ENABLED;
    expect(getLeadConfigMode({ NODE_ENV: "development" })).toBe("partial");
  });
});

describe("LEAD_ASSIGNMENT_V2_ENABLED", () => {
  it("defaults off unless the exact value on is set", () => {
    delete process.env.LEAD_ASSIGNMENT_V2_ENABLED;
    expect(isLeadAssignmentV2Enabled({})).toBe(false);
    expect(isLeadAssignmentV2Enabled({ LEAD_ASSIGNMENT_V2_ENABLED: "on" })).toBe(true);
  });
});

describe("LEAD_DUPLICATE_ENABLED", () => {
  it("defaults off unless the exact value on is set", () => {
    delete process.env.LEAD_DUPLICATE_ENABLED;
    expect(isLeadDuplicateEnabled({})).toBe(false);
    expect(isLeadDuplicateEnabled({ LEAD_DUPLICATE_ENABLED: "on" })).toBe(true);
  });
});

describe("LEAD_ATTRIBUTION_ENABLED", () => {
  it("defaults off unless the exact value on is set", () => {
    delete process.env.LEAD_ATTRIBUTION_ENABLED;
    expect(isLeadAttributionEnabled({})).toBe(false);
    expect(isLeadAttributionEnabled({ LEAD_ATTRIBUTION_ENABLED: "on" })).toBe(true);
  });
});

describe("LEAD_360_ENABLED", () => {
  it("defaults off everywhere unless the exact value on is set", () => {
    delete process.env.LEAD_360_ENABLED;
    expect(isLead360Enabled({})).toBe(false);
    expect(isLead360Enabled({ NODE_ENV: "development" })).toBe(false);
    expect(isLead360Enabled({ NODE_ENV: "production" })).toBe(false);
    expect(isLead360Enabled({ LEAD_360_ENABLED: "true" })).toBe(false);
    expect(isLead360Enabled({ LEAD_360_ENABLED: "ON" })).toBe(false);
    expect(isLead360Enabled({ LEAD_360_ENABLED: "on" })).toBe(true);
  });
});

describe("B12 channel flags", () => {
  it("default off", () => {
    delete process.env.LEAD_SMS_ENABLED;
    delete process.env.LEAD_EMAIL_ENABLED;
    delete process.env.LEAD_WHATSAPP_ENABLED;
    expect(isLeadSmsEnabled({})).toBe(false);
    expect(isLeadEmailEnabled({})).toBe(false);
    expect(isLeadWhatsappEnabled({})).toBe(false);
  });
});
