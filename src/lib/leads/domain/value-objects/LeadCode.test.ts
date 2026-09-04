import { describe, expect, it } from "vitest";

import { LeadInvariantViolationError } from "../errors";
import { LeadCode } from "./LeadCode";

describe("LeadCode", () => {
  it("parses a valid LED-{CITY}-{YYYYMMDD}-{XXXX} code", () => {
    const code = LeadCode.parse("LED-KOL-20260904-0007");
    expect(code.toString()).toBe("LED-KOL-20260904-0007");
    expect(code.cityCode).toBe("KOL");
    expect(code.yyyymmdd).toBe("20260904");
    expect(code.seq).toBe("0007");
  });

  it("accepts OTH city codes from the v1 generator", () => {
    expect(LeadCode.isValid("LED-OTH-20260904-0001")).toBe(true);
  });

  it("rejects malformed codes", () => {
    expect(LeadCode.isValid("LED-KOLKATA-20260904-1")).toBe(false);
    expect(() => LeadCode.parse("bad")).toThrow(LeadInvariantViolationError);
  });
});
