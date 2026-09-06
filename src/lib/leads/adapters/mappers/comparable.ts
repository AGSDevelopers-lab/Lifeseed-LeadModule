const DEFAULT_OMIT = new Set(["updatedAt"]);

export function comparable(
  value: unknown,
  omit: ReadonlySet<string> = DEFAULT_OMIT,
): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => comparable(item, omit));
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("props" in obj && obj.props && typeof obj.props === "object") {
      return comparable(obj.props, omit);
    }
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      if (omit.has(key)) continue;
      out[key] = comparable(obj[key], omit);
    }
    return out;
  }
  return value;
}
