export function jsonRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return { ...(value as Record<string, unknown>) };
}

export function jsonRecordRequired(value: unknown): Record<string, unknown> {
  return jsonRecord(value) ?? {};
}

export function moneyToString(value: unknown): string | null {
  if (value == null) return null;
  return String(value);
}
