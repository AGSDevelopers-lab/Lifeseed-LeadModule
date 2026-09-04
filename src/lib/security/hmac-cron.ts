import { createHmac, timingSafeEqual } from "node:crypto";

const REPLAY_WINDOW_SECONDS = 300;
const SIGNATURE_HEADER = "x-lifeseed-cron-signature";

export class HmacInvalidError extends Error {
  readonly code = "HMAC_INVALID";

  constructor(message = "HMAC signature is invalid") {
    super(message);
    this.name = "HmacInvalidError";
  }
}

export class HmacReplayError extends Error {
  readonly code = "HMAC_REPLAY";

  constructor(message = "HMAC timestamp is outside the replay window") {
    super(message);
    this.name = "HmacReplayError";
  }
}

export type HmacCronMode = "off" | "permissive" | "strict";

export type HmacRequestView = {
  headers: { get(name: string): string | null };
  body: string;
  nowMs?: number;
};

function hmacHex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqualHex(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function parseSignatureHeader(header: string | null): { t: number; v1: string } {
  if (!header) {
    throw new HmacInvalidError("Missing X-LifeSeed-Cron-Signature header");
  }
  const parts = header.split(",").map((p) => p.trim());
  let t: number | null = null;
  let v1: string | null = null;
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") t = Number(value);
    if (key === "v1") v1 = value;
  }
  if (t == null || !Number.isFinite(t) || !v1) {
    throw new HmacInvalidError("Malformed X-LifeSeed-Cron-Signature header");
  }
  return { t, v1 };
}

/**
 * Verifies `X-LifeSeed-Cron-Signature: t=<epoch seconds>, v1=<HMAC-SHA256(t+"."+body, secret)>`.
 * Throws {@link HmacInvalidError} or {@link HmacReplayError}. Returns true when valid.
 */
export function verifyHmacRequest(req: HmacRequestView, secret: string): boolean {
  if (!secret) {
    throw new HmacInvalidError("HMAC secret is not configured");
  }
  const header =
    req.headers.get(SIGNATURE_HEADER) ??
    req.headers.get("X-LifeSeed-Cron-Signature");
  const { t, v1 } = parseSignatureHeader(header);
  const nowMs = req.nowMs ?? Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  if (Math.abs(nowSec - t) > REPLAY_WINDOW_SECONDS) {
    throw new HmacReplayError();
  }
  const expected = hmacHex(secret, `${t}.${req.body}`);
  if (!safeEqualHex(expected, v1)) {
    throw new HmacInvalidError();
  }
  return true;
}

export function signHmacBody(
  body: string,
  secret: string,
  nowMs: number = Date.now(),
): { header: string; timestamp: number } {
  const timestamp = Math.floor(nowMs / 1000);
  const v1 = hmacHex(secret, `${timestamp}.${body}`);
  return {
    header: `t=${timestamp}, v1=${v1}`,
    timestamp,
  };
}

export function leadHmacCronEnforced(): HmacCronMode {
  const raw = process.env.LEAD_HMAC_CRON_ENFORCED?.trim().toLowerCase();
  if (raw === "off" || raw === "permissive" || raw === "strict") return raw;
  const envName = (
    process.env.APP_ENV ??
    process.env.VERCEL_ENV ??
    ""
  ).toLowerCase();
  if (
    envName === "staging" ||
    envName === "preview" ||
    envName === "development" ||
    process.env.NODE_ENV !== "production"
  ) {
    return "permissive";
  }
  return "off";
}

export type LeadCronMachineAuth =
  | { ok: true; via: "hmac" | "static" }
  | {
      ok: false;
      code: "HMAC_INVALID" | "HMAC_REPLAY";
      message: string;
      allowSessionFallback: boolean;
    };

function headersWithCronSignature(header: string | null): {
  get(name: string): string | null;
} {
  return {
    get(name: string) {
      if (name.toLowerCase() === SIGNATURE_HEADER) return header;
      if (name.toLowerCase() === "x-lifeseed-cron-signature") return header;
      return null;
    },
  };
}

/**
 * HMAC vs deprecated static `X-Cron-Secret`, per `LEAD_HMAC_CRON_ENFORCED`.
 * Session fallback is left to the caller when `allowSessionFallback` is true.
 */
export function authorizeLeadCronMachine(args: {
  hmacHeader: string | null;
  staticHeader: string | null;
  body: string;
  hmacSecret: string | undefined;
  staticSecret: string | undefined;
  mode: HmacCronMode;
  nowMs?: number;
}): LeadCronMachineAuth {
  const staticOk = Boolean(
    args.staticSecret &&
      args.staticHeader &&
      args.staticHeader === args.staticSecret,
  );
  const hasHmacHeader = Boolean(args.hmacHeader);

  if (args.mode === "strict") {
    try {
      verifyHmacRequest(
        {
          headers: headersWithCronSignature(args.hmacHeader),
          body: args.body,
          nowMs: args.nowMs,
        },
        args.hmacSecret ?? "",
      );
      return { ok: true, via: "hmac" };
    } catch (err) {
      if (err instanceof HmacReplayError) {
        return {
          ok: false,
          code: "HMAC_REPLAY",
          message: err.message,
          allowSessionFallback: true,
        };
      }
      return {
        ok: false,
        code: "HMAC_INVALID",
        message: err instanceof Error ? err.message : "HMAC invalid",
        allowSessionFallback: true,
      };
    }
  }

  if (hasHmacHeader && args.hmacSecret) {
    try {
      verifyHmacRequest(
        {
          headers: headersWithCronSignature(args.hmacHeader),
          body: args.body,
          nowMs: args.nowMs,
        },
        args.hmacSecret,
      );
      return { ok: true, via: "hmac" };
    } catch (err) {
      if (args.mode === "permissive") {
        if (err instanceof HmacReplayError) {
          return {
            ok: false,
            code: "HMAC_REPLAY",
            message: err.message,
            allowSessionFallback: false,
          };
        }
        return {
          ok: false,
          code: "HMAC_INVALID",
          message: err instanceof Error ? err.message : "HMAC invalid",
          allowSessionFallback: false,
        };
      }
      // mode === 'off': ignore broken HMAC and fall through to static/session
    }
  }

  if (staticOk) {
    console.warn(
      "[leads] X-Cron-Secret is deprecated; use X-LifeSeed-Cron-Signature (HMAC)",
    );
    return { ok: true, via: "static" };
  }

  return {
    ok: false,
    code: "HMAC_INVALID",
    message: "Cron authentication failed",
    allowSessionFallback: true,
  };
}

export async function authorizeLeadCronRequest(
  req: { headers: { get(name: string): string | null }; text(): Promise<string> },
): Promise<
  | { ok: true; via: "hmac" | "static"; body: string }
  | {
      ok: false;
      status: 401;
      code: "HMAC_INVALID" | "HMAC_REPLAY";
      message: string;
      allowSessionFallback: boolean;
      body: string;
    }
> {
  const body = await req.text();
  const result = authorizeLeadCronMachine({
    hmacHeader:
      req.headers.get("x-lifeseed-cron-signature") ??
      req.headers.get("X-LifeSeed-Cron-Signature"),
    staticHeader: req.headers.get("x-cron-secret"),
    body,
    hmacSecret: process.env.LEADS_CRON_HMAC_SECRET,
    staticSecret: process.env.LEADS_CRON_SECRET ?? process.env.CRON_SECRET,
    mode: leadHmacCronEnforced(),
  });
  if (result.ok) {
    return { ok: true, via: result.via, body };
  }
  return {
    ok: false,
    status: 401,
    code: result.code,
    message: result.message,
    allowSessionFallback: result.allowSessionFallback,
    body,
  };
}

export function hmacCronUnauthorizedJson(code: "HMAC_INVALID" | "HMAC_REPLAY", message: string) {
  return {
    error: {
      code,
      message,
    },
  };
}
