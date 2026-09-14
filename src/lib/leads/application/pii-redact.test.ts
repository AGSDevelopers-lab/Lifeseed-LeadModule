import { describe, expect, it } from "vitest";

import { redactAuditJson } from "@/lib/pii-redact";

describe("redactAuditJson", () => {
  it("redacts phone and email in nested payloads", () => {
    expect(
      redactAuditJson({
        phone: "9999999999",
        nested: { email: "a@b.com", status: "NEW" },
      }),
    ).toEqual({
      phone: "[redacted]",
      nested: { email: "[redacted]", status: "NEW" },
    });
  });
});
