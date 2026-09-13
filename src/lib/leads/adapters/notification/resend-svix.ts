import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Resend Cloud webhooks use Svix signing (public Resend docs).
 * signed_content = `${id}.${timestamp}.${rawBody}`
 */
export function verifyResendSvixSignature(input: {
  secret: string;
  rawBody: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
}): boolean {
  const { secret, rawBody, svixId, svixTimestamp, svixSignature } = input;
  if (!secret || !svixId || !svixTimestamp || !svixSignature) return false;
  const signed = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(signed).digest("base64");
  const parts = svixSignature.split(" ");
  for (const part of parts) {
    const sig = part.startsWith("v1,") ? part.slice(3) : part;
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export function signResendSvix(secret: string, id: string, timestamp: string, rawBody: string): string {
  const signed = `${id}.${timestamp}.${rawBody}`;
  return `v1,${createHmac("sha256", secret).update(signed).digest("base64")}`;
}
