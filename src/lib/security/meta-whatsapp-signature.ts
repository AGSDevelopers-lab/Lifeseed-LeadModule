import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta Cloud API webhook signature: `X-Hub-Signature-256: sha256=<hex>`.
 * HMAC-SHA256 is computed over the raw request body with the app secret.
 */
export function verifyMetaSignature(
  req: { headers: { get(name: string): string | null }; body: string },
  appSecret: string,
): boolean {
  if (!appSecret) return false;
  const header =
    req.headers.get("x-hub-signature-256") ??
    req.headers.get("X-Hub-Signature-256");
  if (!header) return false;
  const prefix = "sha256=";
  if (!header.startsWith(prefix)) return false;
  const provided = header.slice(prefix.length).trim();
  const expected = createHmac("sha256", appSecret)
    .update(req.body)
    .digest("hex");
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function signMetaBody(body: string, appSecret: string): string {
  const hex = createHmac("sha256", appSecret).update(body).digest("hex");
  return `sha256=${hex}`;
}

export function leadWhatsappSignatureEnforced(): boolean {
  const raw = process.env.LEAD_WHATSAPP_SIGNATURE_ENFORCED?.trim().toLowerCase();
  if (raw === "off") return false;
  return true;
}
