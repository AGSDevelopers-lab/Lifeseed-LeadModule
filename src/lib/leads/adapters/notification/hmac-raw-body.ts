import { createHmac, timingSafeEqual } from "node:crypto";

/** UNLOCKED SMS-Magic webhook canonicalization: HMAC-SHA256 of raw body, hex digest. */
export function verifyHmacSha256Hex(
  secret: string,
  rawBody: string,
  header: string | null,
): boolean {
  if (!secret || !header) return false;
  const provided = header.startsWith("sha256=") ? header.slice("sha256=".length) : header;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function signHmacSha256Hex(secret: string, rawBody: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}
