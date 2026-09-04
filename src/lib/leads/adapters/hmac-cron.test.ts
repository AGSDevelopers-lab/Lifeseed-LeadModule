import { describe, expect, it, vi, afterEach } from "vitest";

import {
  HmacInvalidError,
  HmacReplayError,
  authorizeLeadCronMachine,
  signHmacBody,
  verifyHmacRequest,
} from "@/lib/security/hmac-cron";

const SECRET = "cron-hmac-secret";
const BODY = "{\"tick\":true}";

function headers(header: string | null) {
  return {
    get(name: string) {
      if (name.toLowerCase() === "x-lifeseed-cron-signature") return header;
      return null;
    },
  };
}

describe("verifyHmacRequest", () => {
  it("accepts a valid header + body", () => {
    const nowMs = Date.UTC(2026, 8, 4, 12, 0, 0);
    const { header } = signHmacBody(BODY, SECRET, nowMs);
    expect(
      verifyHmacRequest({ headers: headers(header), body: BODY, nowMs }, SECRET),
    ).toBe(true);
  });

  it("throws HmacReplayError when timestamp is older than 5 minutes", () => {
    const signedAt = Date.UTC(2026, 8, 4, 12, 0, 0);
    const { header } = signHmacBody(BODY, SECRET, signedAt);
    const later = signedAt + 301_000;
    expect(() =>
      verifyHmacRequest({ headers: headers(header), body: BODY, nowMs: later }, SECRET),
    ).toThrow(HmacReplayError);
  });

  it("throws HmacInvalidError on wrong signature", () => {
    const nowMs = Date.UTC(2026, 8, 4, 12, 0, 0);
    const { timestamp } = signHmacBody(BODY, SECRET, nowMs);
    expect(() =>
      verifyHmacRequest(
        {
          headers: headers(`t=${timestamp}, v1=deadbeef`),
          body: BODY,
          nowMs,
        },
        SECRET,
      ),
    ).toThrow(HmacInvalidError);
  });
});

describe("authorizeLeadCronMachine", () => {
  const nowMs = Date.UTC(2026, 8, 4, 12, 0, 0);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects static secret when mode is strict", () => {
    const result = authorizeLeadCronMachine({
      hmacHeader: null,
      staticHeader: "static-secret",
      body: BODY,
      hmacSecret: SECRET,
      staticSecret: "static-secret",
      mode: "strict",
      nowMs,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("HMAC_INVALID");
  });

  it("accepts HMAC in strict mode", () => {
    const { header } = signHmacBody(BODY, SECRET, nowMs);
    const result = authorizeLeadCronMachine({
      hmacHeader: header,
      staticHeader: null,
      body: BODY,
      hmacSecret: SECRET,
      staticSecret: "static-secret",
      mode: "strict",
      nowMs,
    });
    expect(result).toEqual({ ok: true, via: "hmac" });
  });

  it("accepts static secret in permissive mode and logs deprecation", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = authorizeLeadCronMachine({
      hmacHeader: null,
      staticHeader: "static-secret",
      body: BODY,
      hmacSecret: SECRET,
      staticSecret: "static-secret",
      mode: "permissive",
      nowMs,
    });
    expect(result).toEqual({ ok: true, via: "static" });
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/deprecated/i);
  });

  it("returns HMAC_REPLAY without session fallback in permissive when header is stale", () => {
    const signedAt = nowMs - 400_000;
    const { header } = signHmacBody(BODY, SECRET, signedAt);
    const result = authorizeLeadCronMachine({
      hmacHeader: header,
      staticHeader: "static-secret",
      body: BODY,
      hmacSecret: SECRET,
      staticSecret: "static-secret",
      mode: "permissive",
      nowMs,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("HMAC_REPLAY");
      expect(result.allowSessionFallback).toBe(false);
    }
  });
});
