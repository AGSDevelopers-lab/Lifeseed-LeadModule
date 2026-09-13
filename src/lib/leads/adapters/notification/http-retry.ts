export type RetryingFetch = typeof fetch;

export class TransientHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "TransientHttpError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  fetchFn: RetryingFetch,
  url: string,
  init: RequestInit,
  options?: { maxAttempts?: number; now?: () => number },
): Promise<Response> {
  const maxAttempts = options?.maxAttempts ?? 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetchFn(url, init);
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = res.headers.get("retry-after");
      const retryAfterMs = retryAfter
        ? Number(retryAfter) * (Number.isFinite(Number(retryAfter)) ? 1000 : 0)
        : 25 * attempt;
      lastError = new TransientHttpError(`HTTP ${res.status}`, res.status, retryAfterMs);
      if (attempt < maxAttempts) {
        await sleep(retryAfterMs || 25 * attempt);
        continue;
      }
      throw lastError;
    }
    return res;
  }
  throw lastError instanceof Error ? lastError : new Error("fetchWithRetry exhausted");
}
