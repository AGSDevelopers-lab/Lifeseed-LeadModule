import { describe, expect, it } from "vitest";

import { LeadInvariantViolationError } from "../errors";
import { LeadCode } from "./LeadCode";

const VALID_FIXTURES = [
  "LED-KOL-20260904-0007",
  "LED-HYD-20260101-0001",
  "LED-DEL-20261231-0100",
  "LED-MUM-19990101-9999",
  "LED-OTH-20260904-0001",
  "LED-BLR-20260315-0042",
] as const;

const INVALID_FIXTURES = [
  "LED-KOLKATA-20260904-0001",
  "LED-kol-20260904-0001",
  "LED-KOL-20260904-1",
  "LED-KOL-20260904-00001",
  "LED-KO-20260904-0001",
  "LED-KOL-2026-09-04-0001",
  "LS-KOL-20260904-0001",
  "LED-KOL-20260904",
  "led-KOL-20260904-0001",
  "bad",
  "",
] as const;

describe("LeadCode", () => {
  it("parses a valid LED-{CITY}-{YYYYMMDD}-{XXXX} code", () => {
    const code = LeadCode.parse("LED-KOL-20260904-0007");
    expect(code.toString()).toBe("LED-KOL-20260904-0007");
    expect(code.cityCode).toBe("KOL");
    expect(code.yyyymmdd).toBe("20260904");
    expect(code.seq).toBe("0007");
  });

  it.each(VALID_FIXTURES)("validates fixture %s", (raw) => {
    expect(LeadCode.isValid(raw)).toBe(true);
    const parsed = LeadCode.parse(raw);
    expect(parsed.toString()).toBe(raw);
    expect(parsed.cityCode).toMatch(/^[A-Z]{3}$/);
    expect(parsed.yyyymmdd).toMatch(/^\d{8}$/);
    expect(parsed.seq).toMatch(/^\d{4}$/);
  });

  it.each(INVALID_FIXTURES)("rejects invalid fixture %s", (raw) => {
    expect(LeadCode.isValid(raw)).toBe(false);
    expect(() => LeadCode.parse(raw)).toThrow(LeadInvariantViolationError);
  });

  it("accepts OTH city codes from the v1 generator", () => {
    expect(LeadCode.isValid("LED-OTH-20260904-0001")).toBe(true);
  });

  it("rejects malformed codes", () => {
    expect(LeadCode.isValid("LED-KOLKATA-20260904-1")).toBe(false);
    expect(() => LeadCode.parse("bad")).toThrow(LeadInvariantViolationError);
  });
});
