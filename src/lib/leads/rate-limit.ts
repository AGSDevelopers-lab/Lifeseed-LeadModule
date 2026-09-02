/** Simple in-memory IP rate limiter for public lead intake. */
const hits = new Map<string, { count: number; resetAt: number }>();

export function checkLeadRateLimit(
  ip: string,
  limit = Number(process.env.LEADS_RATE_LIMIT_PER_IP_PER_HOUR ?? "10"),
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (entry.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
    };
  }
  entry.count += 1;
  return { ok: true };
}

/** Periodic cleanup to avoid unbounded growth in long-lived processes. */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) {
      if (v.resetAt < now) hits.delete(k);
    }
  }, 15 * 60 * 1000).unref?.();
}
