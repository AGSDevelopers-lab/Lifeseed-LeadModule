export function redactAuditJson(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(redactAuditJson);
  if (typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  const PII_KEY = /^(aadhaar|aadhaarHash|phone|email|fullName|pan|panNumber|ipAddress|consentIp)$/i;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (PII_KEY.test(k) && (typeof v === "string" || typeof v === "number")) {
      out[k] = "[redacted]";
    } else {
      out[k] = redactAuditJson(v);
    }
  }
  return out;
}
