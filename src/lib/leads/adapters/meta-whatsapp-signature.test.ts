import { describe, expect, it } from "vitest";

import {
  signMetaBody,
  verifyMetaSignature,
} from "@/lib/security/meta-whatsapp-signature";

const SECRET = "meta-app-secret";
const BODY = "{\"object\":\"whatsapp_business_account\"}";

function headers(value: string | null) {
  return {
    get(name: string) {
      if (name.toLowerCase() === "x-hub-signature-256") return value;
      return null;
    },
  };
}

describe("verifyMetaSignature", () => {
  it("accepts a valid Meta payload signature", () => {
    const sig = signMetaBody(BODY, SECRET);
    expect(
      verifyMetaSignature({ headers: headers(sig), body: BODY }, SECRET),
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = signMetaBody(BODY, SECRET);
    expect(
      verifyMetaSignature(
        { headers: headers(sig), body: BODY + " " },
        SECRET,
      ),
    ).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(
      verifyMetaSignature({ headers: headers(null), body: BODY }, SECRET),
    ).toBe(false);
  });
});
