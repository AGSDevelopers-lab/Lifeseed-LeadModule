import "server-only";

import { LRUCache } from "lru-cache";

/**
 * In-memory LRU cache for report results (Vercel serverless-friendly for v1).
 * TODO(reports): migrate to Upstash Redis for multi-instance invalidation in prod.
 */
const DEFAULT_TTL_MS =
  Number(process.env.REPORTS_CACHE_TTL_SECONDS ?? 300) * 1000;

type CacheEntry = { payload: unknown };

const cache = new LRUCache<string, CacheEntry>({
  max: 200,
  ttl: DEFAULT_TTL_MS,
});

export async function withCache<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<{ value: T; fromCache: boolean }> {
  const hit = cache.get(key);
  if (hit !== undefined) {
    return { value: hit.payload as T, fromCache: true };
  }
  const value = await fn();
  cache.set(key, { payload: value }, { ttl: ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS });
  return { value, fromCache: false };
}

export function invalidate(pattern: string): number {
  let removed = 0;
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
      removed += 1;
    }
  }
  return removed;
}

export function cacheKey(
  reportId: string,
  filters: Record<string, unknown>,
  userId: string,
): string {
  return `report:${reportId}:${userId}:${stableStringify(filters)}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}
